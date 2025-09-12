import { useMemo } from 'react';
import { useConfiguration } from '@/hooks/useConfiguration';
import { WorkflowSession } from '@/hooks/useWorkflowRealtime';
import { SessionData } from '@/types/workflow';

/**
 * Hook to provide package data resolution for workflow sessions
 * This separates the package resolution logic from the main workflow hook
 */
export const useWorkflowPackageData = () => {
  const { pacotes, categorias, isLoadingPacotes, isLoadingCategorias } = useConfiguration();

  // Helper function to resolve package data
  const resolvePackageData = useMemo(() => {
    return (session: WorkflowSession) => {
      console.log('📦 Resolving package data for session:', session.id, 'package:', session.pacote);
      
      let packageName = session.pacote || '';
      let packageValue = session.valor_total || 0;
      let packageFotoExtraValue = 35;
      let categoria = session.categoria || '';

      if (session.pacote && pacotes.length > 0) {
        const pkg = pacotes.find((p: any) => p.id === session.pacote || p.nome === session.pacote);
        if (pkg) {
          console.log('📦 Found package for session:', pkg.nome, 'ID:', pkg.id);
          packageName = pkg.nome;
          packageValue = Number(pkg.valor_base) || session.valor_total || 0;
          packageFotoExtraValue = Number(pkg.valor_foto_extra) || 35;
          
          // Try to resolve category from package
          if (pkg.categoria_id && categorias.length > 0) {
            const cat = categorias.find((c: any) => c.id === pkg.categoria_id);
            if (cat) {
              categoria = cat.nome;
              console.log('📂 Resolved category from package:', categoria);
            }
          }
        } else {
          console.warn('📦 Package not found in configuration:', session.pacote);
          packageName = session.pacote; // Keep original if not found
        }
      }

      return {
        packageName,
        packageValue,
        packageFotoExtraValue,
        categoria
      };
    };
  }, [pacotes, categorias]);

  // Convert session to SessionData with proper package resolution
  const convertSessionToData = useMemo(() => {
    return (session: WorkflowSession): SessionData => {
      const packageData = resolvePackageData(session);
      
      const converted: SessionData = {
        id: session.id,
        data: session.data_sessao,
        hora: session.hora_sessao,
        nome: (session as any).clientes?.nome || 'Cliente não encontrado',
        email: (session as any).clientes?.email || '',
        descricao: session.descricao || '',
        status: session.status,
        whatsapp: (session as any).clientes?.telefone || (session as any).clientes?.whatsapp || '',
        categoria: packageData.categoria,
        pacote: packageData.packageName,
        valorPacote: `R$ ${(packageData.packageValue || 0).toFixed(2).replace('.', ',')}`,
        valorFotoExtra: `R$ ${packageData.packageFotoExtraValue.toFixed(2).replace('.', ',')}`,
        qtdFotosExtra: 0,
        valorTotalFotoExtra: 'R$ 0,00',
        produto: '',
        qtdProduto: 0,
        valorTotalProduto: 'R$ 0,00',
        valorAdicional: 'R$ 0,00',
        detalhes: session.descricao || '',
        observacoes: '',
        valor: `R$ ${(session.valor_total || 0).toFixed(2).replace('.', ',')}`,
        total: `R$ ${(session.valor_total || 0).toFixed(2).replace('.', ',')}`,
        valorPago: `R$ ${(session.valor_pago || 0).toFixed(2).replace('.', ',')}`,
        restante: `R$ ${((session.valor_total || 0) - (session.valor_pago || 0)).toFixed(2).replace('.', ',')}`,
        desconto: 0,
        pagamentos: [],
        produtosList: session.produtos_incluidos || [],
        clienteId: session.cliente_id
      };

      console.log('✅ Converted session to SessionData:', converted.id, 'package:', converted.pacote, 'category:', converted.categoria);
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