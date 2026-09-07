import { supabase } from '@/integrations/supabase/client';
import { SessionPaymentExtended } from '@/types/sessionPayments';

export async function fetchUnifiedSessionPayments(sessionId: string): Promise<SessionPaymentExtended[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  // 1. Buscar session_id texto e cliente_id se sessionId for UUID
  let textSessionId = sessionId;
  let clienteId: string | null = null;
  
  const { data: sessaoData } = await supabase
    .from('clientes_sessoes')
    .select('session_id, cliente_id')
    .or(`id.eq.${sessionId},session_id.eq.${sessionId}`)
    .maybeSingle();
  
  if (sessaoData?.session_id) {
    textSessionId = sessaoData.session_id;
    clienteId = sessaoData.cliente_id;
  }

  console.log('🔍 [fetchUnifiedSessionPayments] Session IDs:', { sessionId, textSessionId, clienteId });

  // 2. Buscar transações E cobranças MP EM PARALELO
  const asaasIntegPromise = (supabase as any)
    .from('usuarios_integracoes')
    .select('dados_extras')
    .eq('user_id', user.id)
    .eq('provedor', 'asaas')
    .maybeSingle();

  const [transacoesResult, cobrancasResult] = await Promise.all([
    supabase
      .from('clientes_transacoes')
      .select('*')
      .or(`session_id.eq.${sessionId},session_id.eq.${textSessionId}`)
      .eq('user_id', user.id)
      .order('data_transacao', { ascending: false }),
    supabase
      .from('cobrancas')
      .select('*')
      .or(`session_id.eq.${sessionId},session_id.eq.${textSessionId}`)
      .eq('user_id', user.id)
      .in('status', ['pago', 'estornado'])
      .order('data_pagamento', { ascending: false })
  ]);

  const asaasIntegResult: any = await asaasIntegPromise;
  const transacoes = transacoesResult.data;
  const cobrancasPagas = cobrancasResult.data;
  const asaasExtras: any = asaasIntegResult?.data?.dados_extras || {};
  const asaasSandbox = (asaasExtras?.environment || 'sandbox') !== 'production';

  if (transacoesResult.error) {
    console.error('❌ [fetchUnifiedSessionPayments] Erro ao buscar transações:', transacoesResult.error);
  }

  if (cobrancasResult.error) {
    console.error('❌ [fetchUnifiedSessionPayments] Erro ao buscar cobranças:', cobrancasResult.error);
  }

  const allPayments: SessionPaymentExtended[] = [];
  const addedIds = new Set<string>();
  const refundedPaymentIds = new Set<string>();

  // Extract refunded payment IDs from estornos
  if (transacoes && transacoes.length > 0) {
    for (const t of transacoes) {
      if (t.tipo === 'estorno') {
        const refMatch = t.descricao?.match(/\[REF:([^\]]+)\]/);
        if (refMatch) {
          refundedPaymentIds.add(refMatch[1]);
        }
      }
    }
  }

  // Mapa de cobranças pagas por ID para enriquecimento
  const cobrancasById = new Map<string, any>();
  if (cobrancasPagas && cobrancasPagas.length > 0) {
    for (const c of cobrancasPagas) {
      cobrancasById.set(c.id, c);
    }
  }

  // 4. Converter transações para formato de pagamentos
  if (transacoes && transacoes.length > 0) {
    console.log('✅ [fetchUnifiedSessionPayments] Transações do Supabase:', transacoes.length);

    for (const t of transacoes) {
      const match = t.descricao?.match(/\[ID:([^\]]+)\]/);
      const paymentId = match ? match[1] : t.id;
      
      if (addedIds.has(paymentId)) continue;
      addedIds.add(paymentId);

      const isPaid = t.tipo === 'pagamento';
      const isPending = t.tipo === 'ajuste';
      const isEstorno = t.tipo === 'estorno';

      // Estornos aparecem como tipo especial
      if (isEstorno) {
        const linkedCob = t.cobranca_id ? cobrancasById.get(t.cobranca_id) : null;
        let estornoOrigem: SessionPaymentExtended['origem'] = 'supabase';
        if (linkedCob?.provedor === 'asaas' || t.descricao?.toLowerCase().includes('asaas')) {
          estornoOrigem = 'asaas';
        } else if (linkedCob?.provedor === 'mercadopago' || t.descricao?.toLowerCase().includes('mp #') || t.descricao?.toLowerCase().includes('mercado pago')) {
          estornoOrigem = 'mercadopago';
        } else if (linkedCob?.provedor === 'infinitepay' || t.descricao?.toLowerCase().includes('infinitepay')) {
          estornoOrigem = 'infinitepay';
        } else if (t.descricao?.toLowerCase().includes('crédito') || t.descricao?.toLowerCase().includes('credito')) {
          estornoOrigem = 'credito';
        }

        allPayments.push({
          id: t.id,
          valor: Number(t.valor) || 0,
          data: t.data_transacao || '',
          createdAt: t.created_at || undefined,
          tipo: 'estorno',
          statusPagamento: 'estornado',
          origem: estornoOrigem,
          editavel: false,
          observacoes: t.descricao?.replace(/\s*\[REF:[^\]]+\]/, '') || 'Estorno',
          finalidade: 'estorno',
          cobrancaId: t.cobranca_id || undefined,
        });
        continue;
      }

      const parcelaMatch = t.descricao?.match(/Parcela (\d+)\/(\d+)/);
      const numeroParcela = parcelaMatch ? parseInt(parcelaMatch[1]) : undefined;
      const totalParcelas = parcelaMatch ? parseInt(parcelaMatch[2]) : undefined;

      let tipo: 'pago' | 'agendado' | 'parcelado' = 'pago';
      if (isPending) {
        tipo = totalParcelas ? 'parcelado' : 'agendado';
      }

      let statusPagamento: 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'estornado' = 'pago';
      if (isPending) {
        statusPagamento = 'pendente';
        if (t.data_vencimento) {
          const hoje = new Date();
          const vencimento = new Date(t.data_vencimento);
          if (vencimento < hoje) statusPagamento = 'atrasado';
        }
      } else if (refundedPaymentIds.has(paymentId)) {
        statusPagamento = 'estornado';
      }

      // Detectar origem por descrição
      const isCredito = /\[CREDIT:/i.test(t.descricao || '');
      const isMercadoPago = t.descricao?.toLowerCase().includes('mp #') ||
                             t.descricao?.toLowerCase().includes('mercado pago');
      const isAsaas = t.descricao?.toLowerCase().includes('asaas');
      const isInfinitePay = t.descricao?.toLowerCase().includes('infinitepay');
      const isGateway = isMercadoPago || isAsaas || isInfinitePay;

      // Crédito do cliente aparece como pagamento efetivo, não editável avulsamente
      const origem: SessionPaymentExtended['origem'] = isCredito
        ? 'credito'
        : isMercadoPago
        ? 'mercadopago'
        : isAsaas
        ? 'asaas'
        : isInfinitePay
        ? 'infinitepay'
        : 'supabase';

      const isSandboxAsaas = isAsaas && asaasSandbox;

      const canEdit = !isCredito && (isPending || (!isGateway && isPaid) || (isSandboxAsaas && isPaid));

      // Calculate valor_liquido and taxas from transaction data
      const valorBruto = Number(t.valor) || 0;
      const valorLiq = t.valor_liquido != null ? Number(t.valor_liquido) : undefined;
      const taxaGw = t.taxa_gateway != null ? Number(t.taxa_gateway) : 0;
      const taxaAnt = t.taxa_antecipacao != null ? Number(t.taxa_antecipacao) : 0;
      const taxaTotalCalc = taxaGw + taxaAnt;

      // Determinar finalidade/origem funcional do pagamento
      const linkedCob = t.cobranca_id ? cobrancasById.get(t.cobranca_id) : null;
      let finalidade: SessionPaymentExtended['finalidade'] = 'sessao';
      if (isCredito) {
        finalidade = 'credito';
      } else if (linkedCob?.finalidade === 'fotos_extras' || /(foto[s]?\s+extra|\[extras)/i.test(t.descricao || '')) {
        finalidade = 'fotos_extras';
      } else if (linkedCob?.finalidade === 'sessao_e_extras' || /(sess[ãa]o\s*\+\s*extras|sessao_e_extras)/i.test(t.descricao || '')) {
        finalidade = 'sessao_e_extras';
      } else if (
        linkedCob?.finalidade === 'sinal' ||
        /(sinal|entrada|arras|reserva)/i.test(t.descricao || '') ||
        /(sinal|entrada|arras|reserva)/i.test(linkedCob?.descricao || '')
      ) {
        finalidade = 'sinal';
      } else if (linkedCob?.finalidade) {
        finalidade = linkedCob.finalidade;
      } else if (/(venda\s+avulsa|avulso)/i.test(t.descricao || '')) {
        finalidade = 'avulso';
      } else {
        finalidade = 'sessao';
      }

      allPayments.push({
        id: paymentId,
        valor: valorBruto,
        data: isPaid ? t.data_transacao : '',
        dataVencimento: t.data_vencimento || undefined,
        createdAt: t.created_at || undefined,
        tipo,
        statusPagamento,
        numeroParcela,
        totalParcelas,
        origem,
        finalidade,
        editavel: canEdit,
        observacoes: (t.descricao || '')
          .replace(/\s*\[ID:[^\]]+\]/, '')
          .replace(/\s*\[CREDIT:[^\]]+\]/, '') || '',
        valorLiquido: valorLiq,
        taxaTotal: taxaTotalCalc > 0 ? taxaTotalCalc : undefined,
        taxaAntecipacao: taxaAnt > 0 ? taxaAnt : undefined,
        cobrancaId: (t as any).cobranca_id || undefined,
        sandbox: isSandboxAsaas || undefined,
      });
    }
  }

  // 5. Processar cobranças pagas (MP, InfinitePay, Asaas)
  if (cobrancasPagas && cobrancasPagas.length > 0) {
    console.log('✅ [fetchUnifiedSessionPayments] Cobranças pagas encontradas:', cobrancasPagas.length);

    // Build a map of dados_extras for repasse flags
    const dadosExtrasMap: Record<string, any> = {};
    for (const c of cobrancasPagas) {
      if (c.dados_extras) {
        dadosExtrasMap[c.id] = typeof c.dados_extras === 'string' ? JSON.parse(c.dados_extras) : c.dados_extras;
      }
    }

    // Buscar parcelas para cobranças Asaas com total_parcelas > 1
    const asaasCobrancaIds = cobrancasPagas
      .filter(c => c.provedor === 'asaas' && (c.total_parcelas || 1) > 1)
      .map(c => c.id);

    const parcelasMap: Record<string, any[]> = {};
    if (asaasCobrancaIds.length > 0) {
      const { data: parcelas } = await supabase
        .from('cobranca_parcelas')
        .select('*')
        .in('cobranca_id', asaasCobrancaIds)
        .order('numero_parcela', { ascending: true });

      if (parcelas) {
        for (const p of parcelas) {
          if (!parcelasMap[p.cobranca_id]) parcelasMap[p.cobranca_id] = [];
          parcelasMap[p.cobranca_id].push(p);
        }
      }
    }

    for (const c of cobrancasPagas) {
      const hasMatchingTransaction = transacoes?.some(t => 
        t.descricao?.includes(`cobranca ${c.id}`)
      );
      if (hasMatchingTransaction) continue;

      let provedorLabel: string;
      let origem: 'mercadopago' | 'infinitepay' | 'asaas';
      if (c.provedor === 'infinitepay') {
        provedorLabel = 'InfinitePay';
        origem = 'infinitepay';
      } else if (c.provedor === 'asaas') {
        provedorLabel = `${c.tipo_cobranca === 'pix' ? 'Pix' : 'Link'} Asaas`;
        origem = 'asaas';
      } else {
        provedorLabel = `${c.tipo_cobranca === 'pix' ? 'Pix' : 'Link'} Mercado Pago`;
        origem = 'mercadopago';
      }

      const parcelas = parcelasMap[c.id];
      if (parcelas && parcelas.length > 0) {
        const extras = dadosExtrasMap[c.id] || {};
        const repassarProcessamento = extras.repassarTaxasProcessamento === true;
        const repassarAntecipacao = extras.repassarTaxaAntecipacao === true;

        for (const parcela of parcelas) {
          const parcelaId = `asaas-parcela-${parcela.id}`;
          if (addedIds.has(parcelaId)) continue;
          addedIds.add(parcelaId);

          const rawBase = parcela.valor_principal != null ? Number(parcela.valor_principal) : Number(parcela.valor_bruto);
          const valorBruto = rawBase || 0;
          
          const rawLiq = parcela.valor_liquido != null ? Number(parcela.valor_liquido) : undefined;
          const rawTaxaGw = parcela.taxa_gateway != null ? Number(parcela.taxa_gateway) : 0;
          const rawTaxaAnt = parcela.taxa_antecipacao != null ? Number(parcela.taxa_antecipacao) : 0;
          
          const taxaGwEfetiva = repassarProcessamento ? 0 : rawTaxaGw;
          const taxaAntEfetiva = repassarAntecipacao ? 0 : rawTaxaAnt;
          const valorLiq = (repassarProcessamento && repassarAntecipacao) 
            ? valorBruto 
            : (valorBruto - taxaGwEfetiva - taxaAntEfetiva);
          const taxaTotalCalc = taxaGwEfetiva + taxaAntEfetiva;

          let statusRecebimento: 'pendente' | 'confirmado' | 'recebido' | 'antecipado' = 'pendente';
          if (parcela.status === 'confirmado') statusRecebimento = 'confirmado';
          else if (parcela.status === 'recebido') statusRecebimento = 'recebido';
          else if (parcela.status === 'antecipado') statusRecebimento = 'antecipado';

          const isSandboxAsaas = origem === 'asaas' && asaasSandbox;

          let parcelaFinalidade: SessionPaymentExtended['finalidade'] = 'sessao';
          if (c.finalidade === 'fotos_extras') {
            parcelaFinalidade = 'fotos_extras';
          } else if (c.finalidade === 'sessao_e_extras') {
            parcelaFinalidade = 'sessao_e_extras';
          } else if (c.finalidade === 'sinal' || /(sinal|entrada|arras|reserva)/i.test(c.descricao || '')) {
            parcelaFinalidade = 'sinal';
          } else {
            parcelaFinalidade = c.finalidade || 'sessao';
          }

          allPayments.push({
            id: parcelaId,
            valor: valorBruto,
            data: parcela.data_pagamento ? String(parcela.data_pagamento).split('T')[0] : (c.data_pagamento ? c.data_pagamento.split('T')[0] : ''),
            tipo: 'parcelado',
            statusPagamento: parcela.status === 'pendente' ? 'pendente' : 'pago',
            numeroParcela: parcela.numero_parcela,
            totalParcelas: c.total_parcelas || parcelas.length,
            origem,
            finalidade: parcelaFinalidade,
            editavel: isSandboxAsaas,
            observacoes: `${provedorLabel}${c.descricao ? ` - ${c.descricao}` : ''}`,
            valorLiquido: taxaTotalCalc > 0 ? valorLiq : undefined,
            taxaTotal: taxaTotalCalc > 0 ? taxaTotalCalc : undefined,
            taxaAntecipacao: taxaAntEfetiva > 0 ? taxaAntEfetiva : undefined,
            dataCreditoPrevista: parcela.data_credito || undefined,
            dataCreditoReal: parcela.data_credito_real ? String(parcela.data_credito_real).split('T')[0] : undefined,
            statusRecebimento,
            createdAt: parcela.created_at || undefined,
            cobrancaId: c.id,
            parcelaId: parcela.id,
            sandbox: isSandboxAsaas || undefined,
          });
        }
        continue;
      }

      // Cobrança sem parcelas detalhadas (avulsa ou não-Asaas)
      let paymentId: string;
      if (c.provedor === 'infinitepay') {
        paymentId = `ip-${c.ip_transaction_nsu || c.id}`;
      } else if (c.provedor === 'asaas') {
        paymentId = `asaas-${c.id}`;
      } else {
        paymentId = `mp-${c.mp_payment_id || c.id}`;
      }
      
      if (addedIds.has(paymentId)) continue;
      addedIds.add(paymentId);

      const rawBase = c.valor_principal != null ? Number(c.valor_principal) : Number(c.valor);
      const valorBruto = rawBase || 0;
      const extras = dadosExtrasMap[c.id] || {};
      const repassarProc = extras.repassarTaxasProcessamento === true;
      let valorLiq: number | undefined;
      let taxaTotal: number | undefined;
      
      if (repassarProc) {
        valorLiq = undefined;
        taxaTotal = undefined;
      } else {
        const rawLiq = c.valor_liquido ? Number(c.valor_liquido) : undefined;
        valorLiq = rawLiq;
        taxaTotal = rawLiq != null ? Math.round((valorBruto - rawLiq) * 100) / 100 : undefined;
        if (taxaTotal != null && taxaTotal <= 0) {
          taxaTotal = undefined;
          valorLiq = undefined;
        }
      }

      const isSandboxAsaas = origem === 'asaas' && asaasSandbox;

      let cobFinalidade: SessionPaymentExtended['finalidade'] = 'sessao';
      if (c.finalidade === 'fotos_extras') {
        cobFinalidade = 'fotos_extras';
      } else if (c.finalidade === 'sessao_e_extras') {
        cobFinalidade = 'sessao_e_extras';
      } else if (c.finalidade === 'sinal' || /(sinal|entrada|arras|reserva)/i.test(c.descricao || '')) {
        cobFinalidade = 'sinal';
      } else {
        cobFinalidade = c.finalidade || 'sessao';
      }

      allPayments.push({
        id: paymentId,
        valor: valorBruto,
        data: c.data_pagamento ? c.data_pagamento.split('T')[0] : '',
        tipo: 'pago',
        statusPagamento: c.status === 'estornado' || refundedPaymentIds.has(paymentId) ? 'estornado' : 'pago',
        origem,
        finalidade: cobFinalidade,
        editavel: isSandboxAsaas,
        observacoes: `${provedorLabel}${c.descricao ? ` - ${c.descricao}` : ''}`,
        valorLiquido: valorLiq,
        taxaTotal,
        dataCreditoPrevista: c.data_credito || undefined,
        dataCreditoReal: c.data_credito_real ? String(c.data_credito_real).split('T')[0] : undefined,
        cobrancaId: c.id,
        sandbox: isSandboxAsaas || undefined,
      });
    }
  }

  if (allPayments.length > 0) {
    console.log('✅ [fetchUnifiedSessionPayments] Total pagamentos unificados:', allPayments.length);
    allPayments.sort((a, b) => {
      const timestampA = a.createdAt || a.data || a.dataVencimento || '';
      const timestampB = b.createdAt || b.data || b.dataVencimento || '';
      return timestampB.localeCompare(timestampA);
    });
  }

  return allPayments;
}
