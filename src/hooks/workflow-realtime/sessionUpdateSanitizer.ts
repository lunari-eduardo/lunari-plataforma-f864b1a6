import { supabase } from '@/integrations/supabase/client';
import { WorkflowSession } from './types';
import { calculateSessionTotal, calculateManualProductsTotal } from '@/utils/sessionCalculations';

export interface ExecuteSessionUpdateResult {
  hasChanges: boolean;
  sanitizedUpdates?: Partial<WorkflowSession>;
  fullUpdatedSession?: WorkflowSession | null;
}

export const executeSessionUpdate = async (
  id: string,
  updates: any,
  currentSession: any,
  userId: string,
): Promise<ExecuteSessionUpdateResult> => {
  // FASE 3: PROTEÇÃO - NUNCA permitir que regras_congeladas seja sobrescrito com NULL
  if (
    'regrasDePrecoFotoExtraCongeladas' in updates &&
    (updates.regrasDePrecoFotoExtraCongeladas === null || updates.regrasDePrecoFotoExtraCongeladas === undefined)
  ) {
    console.warn('⚠️ Tentativa de sobrescrever regras_congeladas com NULL bloqueada');
    delete updates.regrasDePrecoFotoExtraCongeladas;
  }

  // Create sanitized update map
  const sanitizedUpdates: Partial<WorkflowSession> = {};

  // Armazenar package ID para sincronização com appointments
  let syncPackageId: string | null = null;
  let syncCategoryName: string | null = null;

  // Import services for package lookup
  const { configurationService } = await import('@/services/ConfigurationService');

  for (const [field, value] of Object.entries(updates)) {
    switch (field) {
      case 'pacote':
        // Handle clear (empty string / null) — user picked "Nenhum pacote"
        if ((typeof value === 'string' && value === '') || value === null || value === undefined) {
          console.log('🧹 Clearing package selection for session:', id);
          sanitizedUpdates.pacote = '';
          sanitizedUpdates.valor_base_pacote = 0;
          sanitizedUpdates.valor_foto_extra = 0;
          sanitizedUpdates.valor_total_foto_extra = 0;
          sanitizedUpdates.categoria = '';
          sanitizedUpdates.regras_congeladas = {
            pacote: null,
            precificacaoFotoExtra: null,
            produtos: [],
            dataCongelamento: new Date().toISOString(),
          } as any;
          const produtosAtuais = currentSession?.produtos_incluidos || [];
          const produtosManuais = Array.isArray(produtosAtuais)
            ? produtosAtuais.filter((p: any) => p.tipo === 'manual')
            : [];
          sanitizedUpdates.produtos_incluidos = produtosManuais;
          const novoTotal = calculateSessionTotal({
            valorBase: 0,
            valorFotoExtra: 0,
            valorProdutos: calculateManualProductsTotal(produtosManuais),
            valorAdicional: Number(currentSession?.valor_adicional) || 0,
            desconto: Number(currentSession?.desconto) || 0,
          });
          sanitizedUpdates.valor_total = novoTotal;
          break;
        }
        // Handle both package name and ID
        if (typeof value === 'string' && value) {
          console.log('🔄 Processing package change:', value);
          const packages = await configurationService.loadPacotesAsync();
          const categorias = await configurationService.loadCategoriasAsync();

          const pkg = packages.find((p: any) => p.id === value || p.nome === value);
          if (pkg) {
            console.log('📦 Package found:', pkg.nome, 'ID:', pkg.id);
            sanitizedUpdates.pacote = pkg.nome;
            syncPackageId = pkg.id;

            if (pkg.valor_base) {
              sanitizedUpdates.valor_base_pacote = Number(pkg.valor_base);
            }

            let novaCategoria = currentSession?.categoria;
            if (pkg.categoria_id) {
              const cat = categorias.find((c: any) => c.id === pkg.categoria_id);
              if (cat) {
                novaCategoria = cat.nome;
                sanitizedUpdates.categoria = cat.nome;
                syncCategoryName = cat.nome;
              }
            }

            const { pricingFreezingService } = await import('@/services/PricingFreezingService');
            const novasRegrasCongeladas = await pricingFreezingService.congelarDadosCompletos(
              pkg.id,
              novaCategoria,
            );
            sanitizedUpdates.regras_congeladas = novasRegrasCongeladas as any;

            const produtosAtuais = currentSession?.produtos_incluidos || [];
            const produtosManuais = Array.isArray(produtosAtuais)
              ? produtosAtuais.filter((p: any) => p.tipo === 'manual')
              : [];

            const produtosNovoPacote = novasRegrasCongeladas.produtos || [];
            sanitizedUpdates.produtos_incluidos = [...produtosNovoPacote, ...produtosManuais];

            const valorFotoExtraInicial = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(
              1,
              novasRegrasCongeladas,
            ).valorUnitario;
            sanitizedUpdates.valor_foto_extra = valorFotoExtraInicial;

            if (currentSession?.qtd_fotos_extra && currentSession.qtd_fotos_extra > 0) {
              const { valorUnitario, valorTotal } = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(
                currentSession.qtd_fotos_extra,
                novasRegrasCongeladas,
              );
              sanitizedUpdates.valor_foto_extra = valorUnitario;
              sanitizedUpdates.valor_total_foto_extra = valorTotal;
            }

            const novoValorTotal = calculateSessionTotal({
              valorBase: sanitizedUpdates.valor_base_pacote || 0,
              valorFotoExtra: sanitizedUpdates.valor_total_foto_extra || 0,
              valorProdutos: calculateManualProductsTotal(produtosManuais),
              valorAdicional: Number(currentSession?.valor_adicional) || 0,
              desconto: Number(currentSession?.desconto) || 0,
            });
            sanitizedUpdates.valor_total = novoValorTotal;
          } else {
            sanitizedUpdates.pacote = value;
          }
        }
        break;

      case 'valorTotal':
        sanitizedUpdates.valor_total = Number(value) || 0;
        break;

      case 'valorPacote':
        if (typeof value === 'string') {
          sanitizedUpdates.valor_total = parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        } else if (typeof value === 'number') {
          sanitizedUpdates.valor_total = value;
        }
        break;

      case 'produtosList':
        if (Array.isArray(value)) {
          const produtosConvertidos = value.map((p: any) => {
            const etapas = Array.isArray(p.etapas)
              ? p.etapas.map((e: any) => ({
                  id: String(e?.id ?? ''),
                  nome: String(e?.nome ?? ''),
                  done: !!e?.done,
                }))
              : undefined;
            const base: any = {
              id: p.id,
              produtoId: p.produtoId,
              nome: p.nome,
              quantidade: Number(p.quantidade) || 0,
              valorUnitario: Number(p.valorUnitario) || 0,
              tipo: p.tipo || 'manual',
              fluxo: p.fluxo === 'custom' ? 'custom' : 'padrao',
              produzido: !!p.produzido,
              entregue: !!p.entregue,
            };
            const prazo =
              typeof p.prazoEntrega === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.prazoEntrega)
                ? p.prazoEntrega.slice(0, 10)
                : undefined;
            if (prazo) base.prazoEntrega = prazo;
            const anyDone = Array.isArray(etapas) && etapas.some((e: any) => e.done);
            const startedFlag = !!p.started || anyDone;
            base.started = startedFlag;
            if (startedFlag) {
              base.startedAt = (typeof p.startedAt === 'string' && p.startedAt) || new Date().toISOString();
            }
            if (etapas && etapas.length > 0) {
              base.etapas = etapas;
              const entregue = etapas.every((e: any) => e.done);
              const produzido = etapas.length > 1 ? etapas.slice(0, -1).every((e: any) => e.done) : entregue;
              base.entregue = entregue;
              base.produzido = produzido;
            }
            return base;
          });

          sanitizedUpdates.produtos_incluidos = produtosConvertidos;

          const { data: freshSession } = await supabase
            .from('clientes_sessoes')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

          if (freshSession) {
            const { pricingFreezingService } = await import('@/services/PricingFreezingService');
            const regrasAtualizadas = await pricingFreezingService.recongelarProdutos(
              freshSession.regras_congeladas as any,
              produtosConvertidos,
            );
            sanitizedUpdates.regras_congeladas = regrasAtualizadas as any;

            const { calculateSessionTotalFromRow } = await import('@/utils/sessionCalculations');
            const updatedSession = { ...freshSession, produtos_incluidos: produtosConvertidos };
            sanitizedUpdates.valor_total = calculateSessionTotalFromRow(updatedSession);
          }
        }
        break;

      case 'descricao':
      case 'status':
      case 'categoria':
        (sanitizedUpdates as any)[field] = value;
        break;

      case 'valorFotoExtra': {
        const novoUnit =
          typeof value === 'string'
            ? parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
            : Number(value) || 0;
        const qtdAtual = Number(currentSession?.qtd_fotos_extra) || 0;
        const { recalcFotosExtras } = await import('@/utils/fotosExtrasCalculator');
        const r = recalcFotosExtras({
          qtd: qtdAtual,
          valorFotoExtra: novoUnit,
          regrasCongeladas: currentSession?.regras_congeladas,
          galeriaInfo: {
            galeriaId: currentSession?.galeria_id,
            valorTotalVendido: (currentSession as any)?.galerias?.valor_total_vendido,
            totalFotosExtrasVendidas: (currentSession as any)?.galerias?.total_fotos_extras_vendidas,
          },
          manualOverride: true,
        });
        sanitizedUpdates.valor_foto_extra = novoUnit > 0 ? novoUnit : r.valorUnitarioEfetivo;
        sanitizedUpdates.valor_total_foto_extra = Number(
          (qtdAtual * (sanitizedUpdates.valor_foto_extra as number)).toFixed(2),
        );
        (sanitizedUpdates as any).extras_overridden = !r.respeitarBanco;
        (sanitizedUpdates as any).extras_overridden_at = r.respeitarBanco ? null : new Date().toISOString();
        break;
      }

      case 'qtdFotosExtra': {
        const qtd = Number(value) || 0;
        const unitAtual = Number(currentSession?.valor_foto_extra) || 0;
        const { recalcFotosExtras } = await import('@/utils/fotosExtrasCalculator');
        const r = recalcFotosExtras({
          qtd,
          valorFotoExtra: unitAtual,
          regrasCongeladas: currentSession?.regras_congeladas,
          galeriaInfo: {
            galeriaId: currentSession?.galeria_id,
            valorTotalVendido: (currentSession as any)?.galerias?.valor_total_vendido,
            totalFotosExtrasVendidas: (currentSession as any)?.galerias?.total_fotos_extras_vendidas,
          },
          manualOverride: true,
        });
        sanitizedUpdates.qtd_fotos_extra = qtd;
        sanitizedUpdates.valor_foto_extra = unitAtual > 0 ? unitAtual : r.valorUnitarioEfetivo;
        sanitizedUpdates.valor_total_foto_extra = Number((qtd * (sanitizedUpdates.valor_foto_extra as number)).toFixed(2));
        (sanitizedUpdates as any).extras_overridden = !r.respeitarBanco;
        (sanitizedUpdates as any).extras_overridden_at = r.respeitarBanco ? null : new Date().toISOString();
        break;
      }

      case 'resyncExtrasWithGallery':
        (sanitizedUpdates as any).extras_overridden = false;
        (sanitizedUpdates as any).extras_overridden_at = null;
        break;

      case 'valorTotalFotoExtra':
        sanitizedUpdates.valor_total_foto_extra =
          typeof value === 'string'
            ? parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
            : Number(value) || 0;
        break;

      case 'regrasDePrecoFotoExtraCongeladas':
        sanitizedUpdates.regras_congeladas = value;
        break;

      case 'desconto':
        sanitizedUpdates.desconto =
          typeof value === 'string'
            ? parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
            : Number(value) || 0;
        break;

      case 'valorAdicional':
        sanitizedUpdates.valor_adicional =
          typeof value === 'string'
            ? parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
            : Number(value) || 0;
        break;

      case 'observacoes':
      case 'detalhes':
        (sanitizedUpdates as any)[field] = value as string;
        break;

      case 'total': {
        const numericTotal =
          typeof value === 'string'
            ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'))
            : Number(value);
        sanitizedUpdates.valor_total = numericTotal || 0;
        break;
      }

      case 'produto':
      case 'qtdProduto':
      case 'valorTotalProduto':
      case 'valor':
      case 'valorPago':
      case 'restante':
      case 'pagamentos':
        break;

      default: {
        const validFields = {
          id: '',
          user_id: '',
          cliente_id: '',
          session_id: '',
          appointment_id: '',
          orcamento_id: '',
          data_sessao: '',
          hora_sessao: '',
          categoria: '',
          pacote: '',
          descricao: '',
          status: '',
          valor_total: 0,
          valor_pago: 0,
          produtos_incluidos: null,
        };
        if (field in validFields) {
          (sanitizedUpdates as any)[field] = value;
        }
        break;
      }
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    return { hasChanges: false };
  }

  // ATOMIC TOTAL CALCULATION
  const totalAffectingFields = [
    'valor_base_pacote',
    'qtd_fotos_extra',
    'valor_foto_extra',
    'valor_total_foto_extra',
    'desconto',
    'valor_adicional',
    'produtos_incluidos',
  ];
  const hasTotalAffectingChanges = totalAffectingFields.some((field) => field in sanitizedUpdates);

  if (hasTotalAffectingChanges && currentSession) {
    const snapshot = {
      valor_base_pacote: sanitizedUpdates.valor_base_pacote ?? currentSession.valor_base_pacote ?? 0,
      valor_total_foto_extra: sanitizedUpdates.valor_total_foto_extra ?? currentSession.valor_total_foto_extra ?? 0,
      valor_adicional: sanitizedUpdates.valor_adicional ?? currentSession.valor_adicional ?? 0,
      desconto: sanitizedUpdates.desconto ?? currentSession.desconto ?? 0,
      produtos_incluidos: sanitizedUpdates.produtos_incluidos ?? currentSession.produtos_incluidos ?? [],
    };

    const valorProdutos = calculateManualProductsTotal(snapshot.produtos_incluidos as any);
    const novoTotal = calculateSessionTotal({
      valorBase: Number(snapshot.valor_base_pacote) || 0,
      valorFotoExtra: Number(snapshot.valor_total_foto_extra) || 0,
      valorProdutos,
      valorAdicional: Number(snapshot.valor_adicional) || 0,
      desconto: Number(snapshot.desconto) || 0,
    });
    sanitizedUpdates.valor_total = novoTotal;
  }

  // Diff check
  if (currentSession) {
    let hasChanges = false;
    const fieldsToCheck = [
      'pacote',
      'valor_total',
      'valor_pago',
      'qtd_fotos_extra',
      'valor_foto_extra',
      'valor_total_foto_extra',
      'produtos_incluidos',
      'categoria',
      'descricao',
      'status',
      'regras_congeladas',
      'desconto',
      'valor_adicional',
      'observacoes',
      'detalhes',
    ];

    if (sanitizedUpdates.regras_congeladas || 'produtos_incluidos' in sanitizedUpdates) {
      hasChanges = true;
    } else {
      for (const field of fieldsToCheck) {
        const newValue = sanitizedUpdates[field as keyof WorkflowSession];
        const currentValue = currentSession[field as keyof WorkflowSession];
        if (newValue !== undefined && JSON.stringify(newValue) !== JSON.stringify(currentValue)) {
          hasChanges = true;
          break;
        }
      }
    }

    if (!hasChanges) {
      return { hasChanges: false };
    }
  }

  sanitizedUpdates.updated_by = userId;

  const { error } = await supabase
    .from('clientes_sessoes')
    .update(sanitizedUpdates)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;

  // Sincronizar com appointment se necessário
  if (syncPackageId && currentSession?.appointment_id) {
    try {
      await supabase
        .from('appointments')
        .update({
          package_id: syncPackageId,
          type: syncCategoryName || currentSession.categoria,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentSession.appointment_id);
    } catch (syncError) {
      console.error('❌ [SYNC] Erro na sincronização Workflow → Agenda:', syncError);
    }
  }

  // Read-back e correção automática de total
  if (hasTotalAffectingChanges && currentSession) {
    const { data: updatedSession } = await supabase
      .from('clientes_sessoes')
      .select('id, valor_total, valor_base_pacote, qtd_fotos_extra, valor_total_foto_extra, valor_adicional, desconto, produtos_incluidos')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (updatedSession) {
      const valorProdutos = calculateManualProductsTotal(updatedSession.produtos_incluidos as any);
      const expectedTotal = calculateSessionTotal({
        valorBase: Number(updatedSession.valor_base_pacote) || 0,
        valorFotoExtra: Number(updatedSession.valor_total_foto_extra) || 0,
        valorProdutos,
        valorAdicional: Number(updatedSession.valor_adicional) || 0,
        desconto: Number(updatedSession.desconto) || 0,
      });
      const actualTotal = Number(updatedSession.valor_total);

      if (Math.abs(expectedTotal - actualTotal) > 0.01) {
        await supabase
          .from('clientes_sessoes')
          .update({ valor_total: expectedTotal, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
        sanitizedUpdates.valor_total = expectedTotal;
      }
    }
  }

  // Buscar sessão completa com cliente
  const { data: fullUpdatedSession } = await supabase
    .from('clientes_sessoes')
    .select(`*, clientes(nome)`)
    .eq('id', id)
    .single();

  return {
    hasChanges: true,
    sanitizedUpdates,
    fullUpdatedSession: (fullUpdatedSession as WorkflowSession) || null,
  };
};
