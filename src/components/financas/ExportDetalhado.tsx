import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, AlertCircle, User, FileText, List } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useUserProfile, useUserBranding } from '@/hooks/useUserProfile';
import { generateExtratoDetalhadoPDF, ExtratoDetalhadoData } from '@/utils/extratoDemonstrativePdfUtils';
import { DadosExportacaoExtrato } from '@/types/extrato';
import { TransacaoComItem } from '@/types/financas';
import PeriodSelectionModal from './PeriodSelectionModal';
import { parseDateFromStorage, formatDateForPDF } from '@/utils/dateUtils';

interface ExportDetalhadoProps {
  dados: DadosExportacaoExtrato;
}

export default function ExportDetalhado({ dados }: ExportDetalhadoProps) {
  const { getProfileOrDefault } = useUserProfile();
  const { getBrandingOrDefault } = useUserBranding();
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  const validateProfileData = () => {
    const profile = getProfileOrDefault();
    return !!(profile.empresa || profile.nome);
  };

  const handleExportRequest = () => {
    if (!validateProfileData()) {
      setShowProfileModal(true);
      return;
    }
    setShowPeriodModal(true);
  };

  const handleExportWithPeriod = async ({ startDate, endDate, format }: {
    startDate: string;
    endDate: string;
    format: 'csv' | 'pdf';
  }) => {
    try {
      // Filter data by selected period
      const filteredLinhas = dados.linhas.filter(linha => 
        linha.data >= startDate && linha.data <= endDate
      );

      if (format === 'csv') {
        handleExportarCSV(filteredLinhas, startDate, endDate);
        return;
      }

      const profile = getProfileOrDefault();
      const branding = getBrandingOrDefault();
      
      const startDateObj = parseDateFromStorage(startDate);
      const month = startDateObj.getMonth() + 1;
      const year = startDateObj.getFullYear();

      // FASE 1: DEBUG DOS DADOS DE ENTRADA
      console.log('🔍 [Export Debug] Iniciando conversão para PDF');
      console.log('📊 [Export Debug] Dados filtrados:', {
        totalLinhas: filteredLinhas.length,
        periodo: { startDate, endDate },
        exemploLinhas: filteredLinhas.slice(0, 3).map(l => ({
          data: l.data,
          tipo: l.tipo,
          origem: l.origem,
          categoria: l.categoria,
          descricao: l.descricao,
          valor: l.valor
        }))
      });

      // FASE 2: CONVERSÃO CORRIGIDA DE LINHAS PARA TRANSAÇÕES
      const transactions: TransacaoComItem[] = filteredLinhas.map(linha => {
        // FASE 2: CORREÇÃO DO MAPEAMENTO DE GRUPOS
        let grupo_principal: any;
        
        if (linha.tipo === 'entrada') {
          // Entradas do workflow = Receita Operacional
          if (linha.origem === 'workflow') {
            grupo_principal = 'Receita Operacional';
          } else {
            // Entradas do financeiro = usar categoria ou Receita Não Operacional
            grupo_principal = linha.categoria === 'Receita Não Operacional' 
              ? 'Receita Não Operacional' 
              : 'Receita Operacional';
          }
        } else {
          // FASE 2: MAPEAMENTO CORRETO PARA DESPESAS
          if (linha.categoria === 'Despesa Fixa') {
            grupo_principal = 'Despesa Fixa';
          } else if (linha.categoria === 'Investimento') {
            grupo_principal = 'Investimento';
          } else {
            grupo_principal = 'Despesa Variável';
          }
        }

        // FASE 2: VALIDAÇÃO DE DATA ANTES DA CONVERSÃO
        const dataVencimento = linha.data;
        if (!dataVencimento || !dataVencimento.match(/^\d{4}-\d{2}-\d{2}$/)) {
          console.warn('⚠️ [Export Debug] Data inválida encontrada:', linha);
        }

        return {
          id: linha.id,
          item_id: linha.referenciaId || linha.id,
          valor: linha.valor,
          data_vencimento: dataVencimento,
          status: linha.status as any,
          parcelaInfo: linha.parcela,
          parcelas: linha.parcela ? {
            atual: linha.parcela.atual,
            total: linha.parcela.total
          } : null,
          observacoes: linha.observacoes || '',
          userId: 'current-user',
          criadoEm: new Date().toISOString(),
          item: {
            id: linha.referenciaId || linha.id,
            nome: linha.descricao,
            grupo_principal,
            userId: 'current-user',
            ativo: true,
            criadoEm: new Date().toISOString(),
          }
        } as TransacaoComItem;
      });

      // FASE 1: DEBUG DAS TRANSAÇÕES CONVERTIDAS
      console.log('🔄 [Export Debug] Transações convertidas:', {
        total: transactions.length,
        porGrupo: transactions.reduce((acc, t) => {
          const grupo = t.item.grupo_principal;
          acc[grupo] = (acc[grupo] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        exemplos: transactions.slice(0, 3).map(t => ({
          nome: t.item.nome,
          grupo: t.item.grupo_principal,
          valor: t.valor,
          data: t.data_vencimento
        }))
      });

      // Recalculate summary for filtered data
      const filteredSummary = {
        totalReceitas: filteredLinhas.filter(l => l.tipo === 'entrada').reduce((sum, l) => sum + l.valor, 0),
        totalDespesas: filteredLinhas.filter(l => l.tipo === 'saida').reduce((sum, l) => sum + l.valor, 0),
        saldoFinal: 0,
        transacoesPagas: filteredLinhas.filter(l => l.status === 'Pago').length,
        transacoesFaturadas: filteredLinhas.filter(l => l.status === 'Faturado').length,
        transacoesAgendadas: filteredLinhas.filter(l => l.status === 'Agendado').length
      };
      filteredSummary.saldoFinal = filteredSummary.totalReceitas - filteredSummary.totalDespesas;

      const exportData: ExtratoDetalhadoData = {
        profile,
        branding,
        transactions,
        period: { 
          startDate,
          endDate
        },
        summary: filteredSummary
      };

      await generateExtratoDetalhadoPDF(exportData);

      const periodText = `${formatDateForPDF(startDate)} a ${formatDateForPDF(endDate)}`;
      toast.success(`PDF gerado com sucesso para o período ${periodText}!`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar o PDF. Tente novamente.');
    }
  };

  const handleExportarCSV = (linhas: typeof dados.linhas, startDate: string, endDate: string) => {
    const csvContent = [
      ['Data', 'Tipo', 'Descrição', 'Origem', 'Categoria/Cliente', 'Parcela', 'Valor', 'Status'].join(';'),
      ...linhas.map(linha => [
        formatDateForPDF(linha.data),
        linha.tipo === 'entrada' ? 'Entrada' : 'Saída',
        linha.descricao,
        linha.origem === 'workflow' ? 'Workflow' : linha.origem === 'financeiro' ? 'Financeiro' : 'Cartão',
        linha.categoria || linha.cliente || '',
        linha.parcela ? `${linha.parcela.atual}/${linha.parcela.total}` : '',
        linha.valor.toFixed(2).replace('.', ','),
        linha.status
      ].join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `extrato_${startDate}_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const periodText = `${formatDateForPDF(startDate)} a ${formatDateForPDF(endDate)}`;
    toast.success(`CSV exportado com sucesso para o período ${periodText}!`);
  };

  const handleGoToProfile = () => {
    setShowProfileModal(false);
    navigate('/minha-conta');
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExportRequest}
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Modal de seleção de período */}
      <PeriodSelectionModal
        isOpen={showPeriodModal}
        onClose={() => setShowPeriodModal(false)}
        onExport={handleExportWithPeriod}
        dadosExtrato={dados}
        title="Exportar Vista Detalhada"
        description="Selecione o período que deseja exportar"
      />

      {/* Modal de redirecionamento para perfil */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Dados da Empresa Necessários
            </DialogTitle>
            <DialogDescription>
              Para gerar o PDF é necessário preencher as informações da empresa no seu perfil.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Dados obrigatórios:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Nome da empresa ou nome completo</li>
                <li>• CNPJ ou CPF (opcional mas recomendado)</li>
                <li>• Endereço comercial (opcional)</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowProfileModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGoToProfile}
                className="flex-1 gap-2"
              >
                <User className="w-4 h-4" />
                Ir para Minha Conta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}