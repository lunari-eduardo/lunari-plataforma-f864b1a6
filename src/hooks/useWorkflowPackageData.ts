import { useMemo } from 'react';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { WorkflowSession } from '@/hooks/useWorkflowRealtime';
import { SessionData } from '@/types/workflow';

/**
 * Hook to provide package data resolution for workflow sessions
 * This separates the package resolution logic from the main workflow hook
 */
export const useWorkflowPackageData = () => {
  const { pacotes, categorias, isLoadingPacotes, isLoadingCategorias } = useRealtimeConfiguration();

  // Helper function to resolve package data with ABSOLUTE PRIORITY for frozen data
  const resolvePackageData = useMemo(() => {
    return (session: WorkflowSession) => {
      console.log('📦 [FASE 2] Resolving package data for session:', session.id, 'package:', session.pacote);
      
      // FASE 2: PRIORIDADE ABSOLUTA para dados congelados - NUNCA usar resolução dinâmica
      if (session.regras_congeladas?.pacote) {
        const frozenPackage = session.regras_congeladas.pacote;
        console.log('❄️ Usando dados congelados do pacote (PRIORIDADE ABSOLUTA):', frozenPackage.nome);
        
        return {
          packageName: frozenPackage.nome,
          packageValue: frozenPackage.valorBase,
          packageFotoExtraValue: frozenPackage.valorFotoExtra,
          fotosIncluidas: frozenPackage.fotosIncluidas || 0,
          categoria: frozenPackage.categoria || session.categoria
        };
      }
      
      // FALLBACK CRÍTICO: Se não tem dados congelados, exibir erro
      console.error('❌ SESSÃO SEM DADOS CONGELADOS:', session.id, 'pacote:', session.pacote);
      
      return {
        packageName: session.pacote || '⚠️ Pacote Indisponível',
        packageValue: 0,
        packageFotoExtraValue: 0,
        fotosIncluidas: 0,
        categoria: session.categoria || ''
      };
    };
  }, []); // NUNCA depender de pacotes/categorias do contexto global

  // Convert session to SessionData with frozen data priority
  const convertSessionToData = useMemo(() => {
    return (session: WorkflowSession): SessionData => {
      const packageData = resolvePackageData(session);
      
      // Check for frozen product data with fallback merge for checkbox states
      const frozenProducts = session.regras_congeladas?.produtos || [];
      const produtosIncluidos = session.produtos_incluidos || [];
      
      // Mesclar status de produzido/entregue de produtos_incluidos com dados congelados
      // Isso garante retrocompatibilidade com sessões antigas que não tinham esses campos
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
      
      // ✅ FASE 4: Log de debug para sessões sem cliente
      if (!session.clientes || !session.clientes.nome) {
        console.warn('⚠️ Sessão sem cliente detectada:', {
          sessionId: session.id,
          clienteId: session.cliente_id,
          data: session.data_sessao,
          hasClientesProperty: !!session.clientes
        });
      }

      // BLOCO B: Normalizar todos os valores numéricos ANTES de usar .toFixed()
      const descontoNum = Number(session.desconto) || 0;
      const valorAdicionalNum = Number(session.valor_adicional) || 0;
      const valorTotalFotoExtraNum = Number(session.valor_total_foto_extra) || 0;
      const valorFotoExtraNum = Number(session.valor_foto_extra) || 0;
      const valorTotalNum = Number(session.valor_total) || 0;
      const valorBasePacoteNum = Number(packageData.packageValue || session.valor_base_pacote) || 0;
      
      // BLOCO D: PRIORIZAR valor_pago do banco de dados
      // O trigger recompute_session_paid atualiza valor_pago automaticamente
      // quando um pagamento é adicionado/modificado/removido
      const valorPagoNum = Number(session.valor_pago) || 0;
      const restanteNum = valorTotalNum - valorPagoNum;

      console.log('💰 Session valor_pago:', session.id, 'valor_pago:', valorPagoNum, 'restante:', restanteNum);

      const converted: SessionData = {
        id: session.id,
        data: session.data_sessao,
        hora: session.hora_sessao,
        // ✅ FASE 3: Usar tipagem correta sem 'as any'
        nome: session.clientes?.nome || 'Cliente não encontrado',
        email: session.clientes?.email || '',
        descricao: session.descricao || '',
        status: session.status,
        whatsapp: session.clientes?.telefone || session.clientes?.whatsapp || '',
        // CORREÇÃO: Usar categoria resolvida ou manter original
        categoria: packageData.categoria || session.categoria || '',
        // CORREÇÃO: Usar packageName resolvido mas manter referência original se necessário  
        pacote: packageData.packageName || session.pacote || '',
        valorPacote: `R$ ${valorBasePacoteNum.toFixed(2).replace('.', ',')}`,
        // CORREÇÃO: Priorizar valor da sessão, fallback para valor do pacote ou frozen data
        valorFotoExtra: valorFotoExtraNum > 0 ? 
          `R$ ${valorFotoExtraNum.toFixed(2).replace('.', ',')}` : 
          `R$ ${packageData.packageFotoExtraValue.toFixed(2).replace('.', ',')}`,
        // CORREÇÃO: Usar valores da sessão, não zerar
        qtdFotosExtra: session.qtd_fotos_extra || 0,
        valorTotalFotoExtra: `R$ ${valorTotalFotoExtraNum.toFixed(2).replace('.', ',')}`,
        // CORREÇÃO: Mapear regras congeladas - verificar se é sessão manual histórica
        regrasDePrecoFotoExtraCongeladas: session.regras_congeladas?.isManualHistorical || session.regras_congeladas?.source === 'manual_historical'
          ? session.regras_congeladas  // Sessão manual - usar estrutura direta (inclui flag isManualHistorical)
          : (session.regras_congeladas?.precificacaoFotoExtra || null),
        // CRÍTICO: Adicionar regras_congeladas completo para UI e indicadores
        regras_congeladas: session.regras_congeladas,
        produto: '',
        qtdProduto: 0,
        valorTotalProduto: 'R$ 0,00',
        valorAdicional: `R$ ${valorAdicionalNum.toFixed(2).replace('.', ',')}`,
        detalhes: session.detalhes || session.descricao || '',
        observacoes: session.observacoes || '',
        valor: `R$ ${valorTotalNum.toFixed(2).replace('.', ',')}`,
        total: `R$ ${valorTotalNum.toFixed(2).replace('.', ',')}`,
        valorPago: `R$ ${valorPagoNum.toFixed(2).replace('.', ',')}`,
        restante: `R$ ${restanteNum.toFixed(2).replace('.', ',')}`,
        desconto: `R$ ${descontoNum.toFixed(2).replace('.', ',')}`,
        pagamentos: (session as any).pagamentos || [], // Use loaded payments from session
        // CRITICAL: Always prioritize frozen product data
        produtosList: session.regras_congeladas?.produtos?.length > 0 ? 
          session.regras_congeladas.produtos : 
          (session.produtos_incluidos || []),
        clienteId: session.cliente_id,
        // Campo session_id texto (formato workflow-*) para integração Gallery
        sessionId: session.session_id,
        // Campos de integração com Galeria (usando casting para campos dinâmicos)
        galeriaId: (session as any).galeria_id,
        galeriaStatus: (session as any).status_galeria as any,
        galeriaStatusPagamento: (session as any).status_pagamento_fotos_extra as any
      };

      console.log('✅ Converted session to SessionData:', converted.id, 'package:', converted.pacote, 'category:', converted.categoria, 'frozen data:', !!session.regras_congeladas?.pacote);
      return converted;
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