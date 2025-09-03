import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, TrendingUp, TrendingDown, DollarSign, Percent, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForPDF } from '@/utils/dateUtils';
import { DemonstrativoSimplificado as DemonstrativoType } from '@/types/extrato';
import { useUserProfile, useUserBranding } from '@/hooks/useUserProfile';
import { generateDemonstrativePDF, DemonstrativeExportData } from '@/utils/newDemonstrativePdfUtils';
import { TransacaoComItem } from '@/types/financas';
import PeriodSelectionModal from './PeriodSelectionModal';
import { useExtrato } from '@/hooks/useExtrato';
interface DemonstrativoSimplificadoProps {
  demonstrativo: DemonstrativoType;
  periodo: {
    inicio: string;
    fim: string;
  };
  transactions?: TransacaoComItem[];
}
export default function DemonstrativoSimplificado({
  demonstrativo,
  periodo,
  transactions = []
}: DemonstrativoSimplificadoProps) {
  const { getProfileOrDefault } = useUserProfile();
  const { getBrandingOrDefault } = useUserBranding();
  const { prepararDadosExportacao, calcularDemonstrativoParaPeriodo } = useExtrato();
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const {
    receitas,
    despesas,
    resumoFinal
  } = demonstrativo;

  const validateProfileData = () => {
    const profile = getProfileOrDefault();
    return !!(profile.nomeEmpresa || profile.nomeCompleto);
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
    if (format === 'csv') {
      toast.error('Exportação CSV não disponível para demonstrativo. Use a Vista Detalhada.');
      return;
    }

    try {
      const profile = getProfileOrDefault();
      const branding = getBrandingOrDefault();
      
      // Calculate demonstrative for the selected period
      const demonstrativoPeriodo = calcularDemonstrativoParaPeriodo(startDate, endDate);
      
      // Preparar dados para o PDF do demonstrativo
      const exportData: DemonstrativeExportData = {
        profile,
        branding,
        period: {
          startDate,
          endDate
        },
        demonstrativo: demonstrativoPeriodo
      };

      // Usar a nova função específica para demonstrativo
      await generateDemonstrativePDF(exportData);

      const periodText = `${formatDateForPDF(startDate)} a ${formatDateForPDF(endDate)}`;
      toast.success(`PDF do demonstrativo gerado com sucesso para o período ${periodText}!`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar o PDF. Tente novamente.');
    }
  };

  const handleGoToProfile = () => {
    setShowProfileModal(false);
    navigate('/minha-conta');
  };
  const renderSecaoReceitas = () => <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
          Receitas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Receita com sessões</span>
          <span className="font-medium text-green-600">
            {formatCurrency(receitas.sessoes)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Receita com produtos</span>
          <span className="font-medium text-green-600">
            {formatCurrency(receitas.produtos)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Receitas não operacionais</span>
          <span className="font-medium text-green-600">
            {formatCurrency(receitas.naoOperacionais)}
          </span>
        </div>
        
        <Separator />
        
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total de Receitas</span>
          <span className="font-bold text-lg text-green-600">
            {formatCurrency(receitas.totalReceitas)}
          </span>
        </div>
      </CardContent>
    </Card>;
  const renderSecaoDespesas = () => <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
          Despesas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {despesas.categorias.map((categoria, index) => <div key={index} className="space-y-2">
            <div className="font-medium text-sm text-muted-foreground border-b pb-1">
              {categoria.grupo}
            </div>
            
            {categoria.itens.map((item, itemIndex) => <div key={itemIndex} className="flex justify-between items-center pl-4">
                <span className="text-xs text-muted-foreground">{item.nome}</span>
                <span className="text-sm font-medium text-red-600">
                  {formatCurrency(item.valor)}
                </span>
              </div>)}
            
            <div className="flex justify-between items-center pl-4 border-t pt-1">
              <span className="text-sm font-medium">Total {categoria.grupo}</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(categoria.total)}
              </span>
            </div>
            
            {index < despesas.categorias.length - 1 && <Separator className="mt-3" />}
          </div>)}
        
        <Separator />
        
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total de Despesas</span>
          <span className="font-bold text-lg text-red-600">
            {formatCurrency(despesas.totalDespesas)}
          </span>
        </div>
      </CardContent>
    </Card>;
  const renderResumoFinal = () => <Card className="bg-gradient-to-r from-background to-muted/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <DollarSign className="h-5 w-5 mr-2" />
          Resumo Final
        </CardTitle>
        <CardDescription>
          Período: {formatDateForPDF(periodo.inicio)} a{' '}
          {formatDateForPDF(periodo.fim)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Receita total</span>
              <span className="font-medium text-green-600">
                {formatCurrency(resumoFinal.receitaTotal)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm">(-) Total de despesas</span>
              <span className="font-medium text-red-600">
                {formatCurrency(resumoFinal.despesaTotal)}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm flex items-center">
                <Percent className="h-3 w-3 mr-1" />
                Margem líquida
              </span>
              <span className={`font-medium ${resumoFinal.margemLiquida >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {resumoFinal.margemLiquida.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        
        <Separator />
        
        <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
          <span className="font-bold text-lg">= Resultado líquido do período</span>
          <span className={`font-bold text-2xl ${resumoFinal.resultadoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(resumoFinal.resultadoLiquido)}
          </span>
        </div>
      </CardContent>
    </Card>;
  return <div className="space-y-6">
      {/* Header com botão de exportação */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl">Demonstrativo Financeiro</h2>
          <p className="text-muted-foreground">
            Resumo categorizado para análise contábil
          </p>
        </div>
        
        <Button 
          onClick={handleExportRequest}
          className="flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Exportar PDF</span>
        </Button>
      </div>

      {/* Grid de seções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderSecaoReceitas()}
        {renderSecaoDespesas()}
      </div>

      {/* Resumo final */}
      {renderResumoFinal()}

      {/* Modal de seleção de período */}
      <PeriodSelectionModal
        isOpen={showPeriodModal}
        onClose={() => setShowPeriodModal(false)}
        onExport={handleExportWithPeriod}
        dadosExtrato={prepararDadosExportacao()}
        title="Exportar Demonstrativo"
        description="Selecione o período que deseja incluir no demonstrativo"
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
    </div>;
}