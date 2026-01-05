import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, TrendingUp, TrendingDown, DollarSign, User, AlertCircle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/utils/currencyUtils';
import { formatDateForPDF } from '@/utils/dateUtils';
import { DemonstrativoSimplificado as DemonstrativoType } from '@/types/extrato';
import { useUserProfile, useUserBranding } from '@/hooks/useUserProfile';
import { generateDemonstrativePDF, DemonstrativeExportData } from '@/utils/newDemonstrativePdfUtils';
import { TransacaoComItem } from '@/types/financas';
import PeriodSelectionModal from './PeriodSelectionModal';
import { useExtrato } from '@/hooks/useExtrato';
import { cn } from '@/lib/utils';

interface DemonstrativoSimplificadoProps {
  demonstrativo: DemonstrativoType;
  periodo: {
    inicio: string;
    fim: string;
  };
  transactions?: TransacaoComItem[];
}

// Component for a single line item with dotted line
function LineItem({ 
  label, 
  value, 
  isTotal = false,
  isSubtotal = false,
  isNegative = false,
  indent = false,
}: { 
  label: string; 
  value: number; 
  isTotal?: boolean;
  isSubtotal?: boolean;
  isNegative?: boolean;
  indent?: boolean;
}) {
  const valueColor = isNegative 
    ? 'text-red-600 dark:text-red-400' 
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className={cn(
      "flex items-baseline gap-2",
      indent && "pl-4",
      (isTotal || isSubtotal) && "pt-2"
    )}>
      <span className={cn(
        "shrink-0",
        isTotal ? "font-bold text-base" : isSubtotal ? "font-semibold text-sm" : "text-sm text-muted-foreground"
      )}>
        {label}
      </span>
      <span className="flex-1 border-b border-dotted border-muted-foreground/30 min-w-8" />
      <span className={cn(
        "shrink-0 tabular-nums text-right",
        isTotal ? "font-bold text-base" : isSubtotal ? "font-semibold" : "font-medium text-sm",
        valueColor
      )}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

// Section header component
function SectionHeader({ icon: Icon, title, iconColor }: { icon: React.ElementType; title: string; iconColor: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b-2 border-border mb-4">
      <Icon className={cn("h-5 w-5", iconColor)} />
      <h3 className="font-bold text-base uppercase tracking-wide">{title}</h3>
    </div>
  );
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
  
  const { receitas, despesas, resumoFinal } = demonstrativo;

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
    if (format === 'csv') {
      toast.error('Exportação CSV não disponível para demonstrativo. Use a Vista Detalhada.');
      return;
    }

    try {
      const profile = getProfileOrDefault();
      const branding = getBrandingOrDefault();
      const demonstrativoPeriodo = calcularDemonstrativoParaPeriodo(startDate, endDate);
      
      const exportData: DemonstrativeExportData = {
        profile,
        branding,
        period: { startDate, endDate },
        demonstrativo: demonstrativoPeriodo
      };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl">Demonstrativo Financeiro</h2>
          <p className="text-sm text-muted-foreground">
            Resumo categorizado para análise contábil
          </p>
        </div>
        
        <Button onClick={handleExportRequest} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Main Content - Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECEITAS */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <SectionHeader icon={TrendingUp} title="Receitas" iconColor="text-emerald-600" />
            
            <div className="space-y-3">
              <LineItem label="Receita com sessões" value={receitas.sessoes} />
              <LineItem label="Receita com produtos" value={receitas.produtos} />
              <LineItem label="Receitas não operacionais" value={receitas.naoOperacionais} />
              
              <Separator className="my-4" />
              
              <LineItem 
                label="TOTAL DE RECEITAS" 
                value={receitas.totalReceitas} 
                isTotal 
              />
            </div>
          </CardContent>
        </Card>

        {/* DESPESAS */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <SectionHeader icon={TrendingDown} title="Despesas" iconColor="text-red-600" />
            
            <div className="space-y-4">
              {despesas.categorias.map((categoria, index) => (
                <div key={index} className="space-y-2">
                  {/* Category Header */}
                  <div className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                    {categoria.grupo}
                  </div>
                  
                  {/* Category Items */}
                  <div className="space-y-2">
                    {categoria.itens.map((item, itemIndex) => (
                      <LineItem 
                        key={itemIndex} 
                        label={item.nome} 
                        value={item.valor} 
                        indent 
                        isNegative 
                      />
                    ))}
                  </div>
                  
                  {/* Subtotal */}
                  <LineItem 
                    label={`Subtotal ${categoria.grupo}`} 
                    value={categoria.total} 
                    isSubtotal 
                    indent 
                    isNegative 
                  />
                  
                  {index < despesas.categorias.length - 1 && (
                    <Separator className="my-3" />
                  )}
                </div>
              ))}
              
              <Separator className="my-4" />
              
              <LineItem 
                label="TOTAL DE DESPESAS" 
                value={despesas.totalDespesas} 
                isTotal 
                isNegative 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RESUMO FINAL */}
      <Card className="border-0 shadow-sm bg-muted/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 pb-2 border-b-2 border-border mb-4">
            <DollarSign className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base uppercase tracking-wide">Resumo Final</h3>
            <span className="ml-auto text-sm text-muted-foreground">
              Período: {formatDateForPDF(periodo.inicio)} a {formatDateForPDF(periodo.fim)}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <LineItem label="Receita total" value={resumoFinal.receitaTotal} />
              <LineItem label="(-) Total de despesas" value={resumoFinal.despesaTotal} isNegative />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">Margem líquida</span>
                <span className="flex-1 border-b border-dotted border-muted-foreground/30 min-w-8" />
                <span className={cn(
                  "font-semibold tabular-nums",
                  resumoFinal.margemLiquida >= 0 
                    ? "text-emerald-600 dark:text-emerald-400" 
                    : "text-red-600 dark:text-red-400"
                )}>
                  {resumoFinal.margemLiquida.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
          
          {/* Hero Result */}
          <div className={cn(
            "flex items-center justify-between p-6 rounded-xl",
            resumoFinal.resultadoLiquido >= 0 
              ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800" 
              : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
          )}>
            <span className="font-bold text-lg">= Resultado Líquido do Período</span>
            <span className={cn(
              "font-bold text-2xl tabular-nums",
              resumoFinal.resultadoLiquido >= 0 
                ? "text-emerald-600 dark:text-emerald-400" 
                : "text-red-600 dark:text-red-400"
            )}>
              {formatCurrency(resumoFinal.resultadoLiquido)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <PeriodSelectionModal
        isOpen={showPeriodModal}
        onClose={() => setShowPeriodModal(false)}
        onExport={handleExportWithPeriod}
        dadosExtrato={prepararDadosExportacao()}
        title="Exportar Demonstrativo"
        description="Selecione o período que deseja incluir no demonstrativo"
      />

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
    </div>
  );
}
