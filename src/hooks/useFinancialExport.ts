import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useUserProfile, useUserBranding } from './useUserProfile';
import { useNovoFinancas } from './useNovoFinancas';
import { generateFinancialPDF, FinancialExportData, ExportOptions } from '@/utils/financialPdfUtils';
import { FinancialSummary, ExportConfigState } from '@/types/financialExport';
import { TransacaoComItem, StatusTransacao } from '@/types/financas';

export function useFinancialExport() {
  const { getProfileOrDefault } = useUserProfile();
  const { getBrandingOrDefault } = useUserBranding();
  const { transacoesPorGrupo } = useNovoFinancas();

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

  const getFilteredTransactions = (type: 'monthly' | 'annual', month: number, year: number): TransacaoComItem[] => {
    const allTransactions: TransacaoComItem[] = [];
    
    // Flatten all transactions from all groups
    Object.values(transacoesPorGrupo).forEach(group => {
      allTransactions.push(...group);
    });

    if (type === 'annual') {
      return allTransactions.filter(transaction => {
        const transactionDate = new Date(transaction.data_vencimento);
        return transactionDate.getFullYear() === year;
      });
    } else {
      return allTransactions.filter(transaction => {
        const transactionDate = new Date(transaction.data_vencimento);
        return transactionDate.getMonth() + 1 === month && transactionDate.getFullYear() === year;
      });
    }
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
    
    if (!profile.nomeEmpresa && !profile.nomeCompleto) {
      return null;
    }

    const transactions = getFilteredTransactions(config.type, config.selectedMonth, config.selectedYear);
    const summary = calculateSummary(transactions);

    return {
      profile,
      branding,
      transactions,
      period: {
        month: config.selectedMonth,
        year: config.selectedYear,
        isAnnual: config.type === 'annual'
      },
      summary
    };
  }, [config, getProfileOrDefault, getBrandingOrDefault, transacoesPorGrupo]);

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
    return !!(profile.nomeEmpresa || profile.nomeCompleto);
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