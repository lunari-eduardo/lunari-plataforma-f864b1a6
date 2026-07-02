import { useMemo } from 'react';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { WorkflowSession } from '@/features/workflow';
import { SessionData } from '@/types/workflow';
import { toSafeNumber, formatBRL, safeArray } from '@/utils/workflowNormalization';

/**
 * Hook to provide package data resolution for workflow sessions
 * This separates the package resolution logic from the main workflow hook
 */
export const useWorkflowPackageData = () => {
  const { pacotes, categorias, isLoadingPacotes, isLoadingCategorias } = useRealtimeConfiguration();

  // Helper function to resolve package data with ABSOLUTE PRIORITY for frozen data
  const resolvePackageData = useMemo(() => {
    return (session: WorkflowSession) => {
      // FASE 2: PRIORIDADE ABSOLUTA para dados congelados - NUNCA usar resolução dinâmica
      const frozenPackage = session?.regras_congeladas?.pacote;
      if (frozenPackage && typeof frozenPackage === 'object') {
        return {
          packageName: frozenPackage.nome || session.pacote || '',
          packageValue: toSafeNumber(frozenPackage.valorBase),
          packageFotoExtraValue: toSafeNumber(frozenPackage.valorFotoExtra),
          fotosIncluidas: toSafeNumber(frozenPackage.fotosIncluidas),
          categoria: session.categoria || frozenPackage.categoria || ''
        };
      }

      return {
        packageName: session?.pacote || '⚠️ Pacote Indisponível',
        packageValue: 0,
        packageFotoExtraValue: 0,
        fotosIncluidas: 0,
        categoria: session?.categoria || ''
      };
    };
  }, []);

  // Convert session to SessionData with frozen data priority
  const convertSessionToData = useMemo(() => {
    return (session: WorkflowSession): SessionData => {
      try {
        const packageData = resolvePackageData(session);

        // Mesclar status de produzido/entregue de produtos_incluidos com dados congelados
        const frozenProducts = safeArray(session?.regras_congeladas?.produtos);
        const produtosIncluidos = safeArray(session?.produtos_incluidos);

        const produtosList = frozenProducts.length > 0
          ? frozenProducts.map((fp: any) => {
              const produtoAtual = produtosIncluidos.find((pi: any) => pi.id === fp.id || pi.nome === fp.nome);
              return {
                ...fp,
                produzido: produtoAtual?.produzido ?? fp.produzido ?? false,
                entregue: produtoAtual?.entregue ?? fp.entregue ?? false
              };
            })
          : produtosIncluidos;

        // BLOCO B: Normalizar todos os valores numéricos ANTES de usar .toFixed()
        const descontoNum = toSafeNumber(session.desconto);
        const valorAdicionalNum = toSafeNumber(session.valor_adicional);
        const valorTotalFotoExtraNum = toSafeNumber(session.valor_total_foto_extra);
        const valorFotoExtraNum = toSafeNumber(session.valor_foto_extra);
        const valorTotalNum = toSafeNumber(session.valor_total);
        const valorBasePacoteNum = toSafeNumber(packageData.packageValue || session.valor_base_pacote);
        const valorPagoNum = toSafeNumber(session.valor_pago);
        const restanteNum = valorTotalNum - valorPagoNum;

        const converted: SessionData = {
          id: session.id,
          data: session.data_sessao,
          hora: session.hora_sessao,
          nome: session.clientes?.nome || 'Cliente não encontrado',
          email: session.clientes?.email || '',
          descricao: session.descricao || '',
          status: session.status,
          whatsapp: session.clientes?.telefone || session.clientes?.whatsapp || '',
          categoria: session.categoria || packageData.categoria || '',
          pacote: packageData.packageName || session.pacote || '',
          valorPacote: formatBRL(valorBasePacoteNum),
          valorFotoExtra: valorFotoExtraNum > 0
            ? formatBRL(valorFotoExtraNum)
            : formatBRL(packageData.packageFotoExtraValue),
          qtdFotosExtra: toSafeNumber(session.qtd_fotos_extra),
          valorTotalFotoExtra: formatBRL(valorTotalFotoExtraNum),
          regrasDePrecoFotoExtraCongeladas: session.regras_congeladas?.isManualHistorical || session.regras_congeladas?.source === 'manual_historical'
            ? session.regras_congeladas
            : (session.regras_congeladas?.precificacaoFotoExtra || null),
          regras_congeladas: session.regras_congeladas,
          produto: '',
          qtdProduto: 0,
          valorTotalProduto: 'R$ 0,00',
          valorAdicional: formatBRL(valorAdicionalNum),
          detalhes: session.detalhes || session.descricao || '',
          observacoes: session.observacoes || '',
          valor: formatBRL(valorTotalNum),
          total: formatBRL(valorTotalNum),
          valorPago: formatBRL(valorPagoNum),
          restante: formatBRL(restanteNum),
          desconto: formatBRL(descontoNum),
          pagamentos: safeArray((session as any).pagamentos),
          produtosList: frozenProducts.length > 0 ? frozenProducts : produtosIncluidos,
          clienteId: session.cliente_id,
          sessionId: session.session_id,
          galeriaId: (session as any).galeria_id,
          galeriaStatus: (session as any).status_galeria as any,
          galeriaStatusPagamento: (session as any).status_pagamento_fotos_extra as any,
          extrasOverridden: (session as any).extras_overridden === true
        };

        return converted;
      } catch (err) {
        console.warn('⚠️ convertSessionToData fallback for session', (session as any)?.id, err);
        return {
          id: (session as any)?.id || 'unknown',
          data: (session as any)?.data_sessao || '',
          hora: (session as any)?.hora_sessao || '',
          nome: (session as any)?.clientes?.nome || 'Sessão corrompida',
          email: '',
          descricao: '',
          status: (session as any)?.status ?? '',
          whatsapp: '',
          categoria: (session as any)?.categoria || '',
          pacote: (session as any)?.pacote || '',
          valorPacote: 'R$ 0,00',
          valorFotoExtra: 'R$ 0,00',
          qtdFotosExtra: 0,
          valorTotalFotoExtra: 'R$ 0,00',
          produto: '',
          qtdProduto: 0,
          valorTotalProduto: 'R$ 0,00',
          valorAdicional: 'R$ 0,00',
          detalhes: '',
          observacoes: '',
          valor: 'R$ 0,00',
          total: 'R$ 0,00',
          valorPago: 'R$ 0,00',
          restante: 'R$ 0,00',
          desconto: 'R$ 0,00',
          pagamentos: [],
          produtosList: [],
          clienteId: (session as any)?.cliente_id,
          sessionId: (session as any)?.session_id,
        } as SessionData;
      }
    };
  }, [resolvePackageData]);

  return {
    pacotes,
    categorias,
    isLoadingPacotes,
    isLoadingCategorias,
    resolvePackageData,
    convertSessionToData
  };
};