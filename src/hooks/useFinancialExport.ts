import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useUserProfile, useUserBranding } from './useUserProfile';
import { useNovoFinancas } from './useNovoFinancas';
import { generateFinancialPDF, FinancialExportData, ExportOptions } from '@/utils/financialPdfUtils';
import { FinancialSummary, ExportConfigState } from '@/types/financialExport';
import { TransacaoComItem, StatusTransacao } from '@/types/financas';
import { useAppContext } from '@/contexts/AppContext';

export function useFinancialExport() {
  const { getProfileOrDefault } = useUserProfile();
  const { getBrandingOrDefault } = useUserBranding();
  const { itensFinanceiros } = useNovoFinancas();
  const { workflowItems } = useAppContext();

  const [config, setConfig] = useState<ExportConfigState>({
    isOpen: false,
    type: 'monthly',
    selectedMonth: new Date().getMonth() + 1,
    selectedYear: new Date().getFullYear(),
    includeDetails: true,
    isGenerating: false
  });

  const openExportModal = (type: 'monthly' | 'annual') => {
    setConfig(prev => ({
      ...prev,
      isOpen: true,
      type,
      selectedMonth: new Date().getMonth() + 1,
      selectedYear: new Date().getFullYear()
    }));
  };

  const closeExportModal = () => {
    setConfig(prev => ({
      ...prev,
      isOpen: false,
      isGenerating: false
    }));
  };

  const updateConfig = (updates: Partial<ExportConfigState>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  // Carrega TODAS as transações do hook useNovoFinancas
  const { transacoes: allTransactionsRaw } = useNovoFinancas();
  
  const allTransactions = useMemo<TransacaoComItem[]>(() => {
    return allTransactionsRaw.map((t: any) => {
      const item = itensFinanceiros.find((i) => i.id === t.itemId || i.id === t.item_id) || ({
        id: t.itemId || t.item_id,
        nome: 'Item',
        grupo_principal: 'Despesa Variável',
        userId: t.userId,
        ativo: true,
        criadoEm: t.criadoEm,
      } as any);

      return {
        id: t.id,
        item_id: t.itemId,
        valor: t.valor,
        data_vencimento: t.dataVencimento,
        status: t.status as StatusTransacao,
        parcelaInfo: null,
        parcelas: null,
        observacoes: t.observacoes,
        userId: t.userId,
        criadoEm: t.criadoEm,
        item,
      } as TransacaoComItem;
    });
  }, [itensFinanceiros]);

  const getFilteredTransactions = (type: 'monthly' | 'annual', month: number, year: number): TransacaoComItem[] => {
    if (type === 'annual') {
      return allTransactions.filter((transaction) => {
        const [y] = (transaction.data_vencimento || '').split('-').map(Number);
        return y === year;
      });
    }

    return allTransactions.filter((transaction) => {
      const [y, m] = (transaction.data_vencimento || '').split('-').map(Number);
      return m === month && y === year;
    });
  };

  const calculateSummary = (transactions: TransacaoComItem[]): FinancialSummary => {
    const receitas = transactions
      .filter(t => t.item.grupo_principal === 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);

    const despesas = transactions
      .filter(t => t.item.grupo_principal !== 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);

    const statusCounts = transactions.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<StatusTransacao, number>);

    return {
      totalReceitas: receitas,
      totalDespesas: despesas,
      saldoFinal: receitas - despesas,
      transacoesPagas: statusCounts['Pago'] || 0,
      transacoesFaturadas: statusCounts['Faturado'] || 0,
      transacoesAgendadas: statusCounts['Agendado'] || 0
    };
  };

  const exportData = useMemo((): FinancialExportData | null => {
    const profile = getProfileOrDefault();
    const branding = getBrandingOrDefault();
    
    if (!profile.empresa && !profile.nome) {
      return null;
    }

    const transactions = getFilteredTransactions(config.type, config.selectedMonth, config.selectedYear);
    const baseSummary = calculateSummary(transactions);

    // Calcular receitas do Workflow (operacionais)
    const selectedMonth = config.selectedMonth;
    const selectedYear = config.selectedYear;

    const buildWorkflowMonthlyMap = (): Record<number, number> => {
      const map: Record<number, number> = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 10:0, 11:0, 12:0 };
      workflowItems.forEach((item) => {
        const parts = (item.data || '').split('-');
        if (parts.length < 2) return;
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (y === selectedYear && m >= 1 && m <= 12) {
          map[m] += Number(item.valorPago || 0);
        }
      });
      return map;
    };

    let workflowMonthlyReceita: Record<number, number> | undefined;
    let workflowReceitaPeriodo = 0;

    if (config.type === 'annual') {
      workflowMonthlyReceita = buildWorkflowMonthlyMap();
      workflowReceitaPeriodo = Object.values(workflowMonthlyReceita).reduce((a, b) => a + b, 0);
    } else {
      workflowReceitaPeriodo = workflowItems.reduce((sum, item) => {
        const parts = (item.data || '').split('-');
        if (parts.length < 2) return sum;
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        return sum + (y === selectedYear && m === selectedMonth ? Number(item.valorPago || 0) : 0);
      }, 0);
    }

    const combinedSummary: FinancialSummary = {
      ...baseSummary,
      totalReceitas: baseSummary.totalReceitas + workflowReceitaPeriodo,
      saldoFinal: (baseSummary.totalReceitas + workflowReceitaPeriodo) - baseSummary.totalDespesas,
    };

    return {
      profile,
      branding,
      transactions,
      period: {
        month: config.selectedMonth,
        year: config.selectedYear,
        isAnnual: config.type === 'annual'
      },
      summary: combinedSummary,
      ...(config.type === 'annual' && workflowMonthlyReceita ? { workflowMonthlyReceita } : {})
    } as FinancialExportData;
  }, [config, getProfileOrDefault, getBrandingOrDefault, allTransactions, workflowItems]);

  const generatePDF = async () => {
    if (!exportData) {
      toast.error('Dados insuficientes para gerar o relatório. Verifique as informações da empresa.');
      return;
    }

    setConfig(prev => ({ ...prev, isGenerating: true }));

    try {
      const options: ExportOptions = {
        type: config.type,
        period: {
          month: config.selectedMonth,
          year: config.selectedYear
        },
        includeDetails: config.includeDetails,
        includeGraphics: false
      };

      await generateFinancialPDF(exportData, options);
      
      const periodText = config.type === 'annual' 
        ? `ano de ${config.selectedYear}`
        : `${String(config.selectedMonth).padStart(2, '0')}/${config.selectedYear}`;
      
      toast.success(`PDF gerado com sucesso para ${periodText}!`);
      closeExportModal();
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setConfig(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const canExport = useMemo(() => {
    const profile = getProfileOrDefault();
    return !!(profile.empresa || profile.nome);
  }, [getProfileOrDefault]);

  const exportSummary = useMemo(() => {
    if (!exportData) return null;
    return exportData.summary;
  }, [exportData]);

  return {
    config,
    exportData,
    exportSummary,
    canExport,
    openExportModal,
    closeExportModal,
    updateConfig,
    generatePDF
  };
}