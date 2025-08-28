import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, AlertCircle, User, FileText, List } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useUserProfile, useUserBranding } from '@/hooks/useUserProfile';
import { generateFinancialPDF, FinancialExportData } from '@/utils/financialPdfUtils';
import { DadosExportacaoExtrato } from '@/types/extrato';
import { TransacaoComItem } from '@/types/financas';

interface ExportDetalhadoProps {
  dados: DadosExportacaoExtrato;
}

export default function ExportDetalhado({ dados }: ExportDetalhadoProps) {
  const { getProfileOrDefault } = useUserProfile();
  const { getBrandingOrDefault } = useUserBranding();
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const validateProfileData = () => {
    const profile = getProfileOrDefault();
    return !!(profile.nomeEmpresa || profile.nomeCompleto);
  };

  const handleExportarPDF = async () => {
    if (!validateProfileData()) {
      setShowProfileModal(true);
      return;
    }

    setIsGenerating(true);
    try {
      const profile = getProfileOrDefault();
      const branding = getBrandingOrDefault();
      
      const startDate = new Date(dados.periodo.inicio);
      const month = startDate.getMonth() + 1;
      const year = startDate.getFullYear();

      // Converter linhas do extrato para formato de transações
      const transactions: TransacaoComItem[] = dados.linhas.map(linha => ({
        id: linha.id,
        item_id: linha.referenciaId,
        valor: linha.valor,
        data_vencimento: linha.data,
        status: linha.status,
        parcelaInfo: linha.parcela,
        parcelas: null,
        observacoes: linha.observacoes || '',
        userId: 'current-user',
        criadoEm: new Date().toISOString(),
        item: {
          id: linha.referenciaId,
          nome: linha.descricao,
          grupo_principal: linha.categoria || (linha.tipo === 'entrada' ? 'Receita Operacional' : 'Despesa Variável'),
          userId: 'current-user',
          ativo: true,
          criadoEm: new Date().toISOString(),
        }
      } as TransacaoComItem));

      const exportData: FinancialExportData = {
        profile,
        branding,
        transactions,
        period: { month, year, isAnnual: false },
        summary: {
          totalReceitas: dados.resumo.totalEntradas,
          totalDespesas: dados.resumo.totalSaidas,
          saldoFinal: dados.resumo.saldoPeriodo,
          transacoesPagas: dados.linhas.filter(l => l.status === 'Pago').length,
          transacoesFaturadas: dados.linhas.filter(l => l.status === 'Faturado').length,
          transacoesAgendadas: dados.linhas.filter(l => l.status === 'Agendado').length
        }
      };

      await generateFinancialPDF(exportData, {
        type: 'monthly',
        period: { month, year },
        includeDetails: true,
        includeGraphics: false
      });

      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportarCSV = () => {
    const csvContent = [
      ['Data', 'Tipo', 'Descrição', 'Origem', 'Categoria/Cliente', 'Parcela', 'Valor', 'Status'].join(';'),
      ...dados.linhas.map(linha => [
        new Date(linha.data).toLocaleDateString('pt-BR'),
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
    link.setAttribute('download', `extrato_${dados.periodo.inicio}_${dados.periodo.fim}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV exportado com sucesso!');
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
          onClick={handleExportarCSV}
        >
          <List className="h-4 w-4 mr-2" />
          CSV
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExportarPDF}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Gerando...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </>
          )}
        </Button>
      </div>

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