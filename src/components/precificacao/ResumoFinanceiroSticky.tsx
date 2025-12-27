import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronUp, ChevronDown, Wallet, Clock, Target, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResumoFinanceiroStickyProps {
  custoFixoMensal: number;
  custoHora: number;
  metaFaturamentoMensal: number;
  precoFinalServico?: number;
  isCalculating?: boolean;
}

export function ResumoFinanceiroSticky({
  custoFixoMensal,
  custoHora,
  metaFaturamentoMensal,
  precoFinalServico,
  isCalculating = false
}: ResumoFinanceiroStickyProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };

  const indicadores = [
    {
      label: 'Custo Fixo Mensal',
      value: custoFixoMensal,
      icon: Wallet,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      label: 'Custo da Hora',
      value: custoHora,
      icon: Clock,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20'
    },
    {
      label: 'Meta Mensal',
      value: metaFaturamentoMensal,
      icon: Target,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    }
  ];

  // Desktop Sidebar
  const DesktopSidebar = () => (
    <div className="hidden lg:block sticky top-4 w-72 h-fit">
      <Card className="shadow-lg border-2 border-primary/20 bg-gradient-to-br from-card to-muted/30">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Resumo Financeiro</h3>
          </div>

          <div className="space-y-3">
            {indicadores.map((ind, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "rounded-lg p-3 transition-all duration-300",
                  ind.bgColor,
                  isCalculating && "animate-pulse"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ind.icon className={cn("h-4 w-4", ind.color)} />
                  <span className="text-xs text-muted-foreground">{ind.label}</span>
                </div>
                <p className={cn("text-lg font-bold", ind.color)}>
                  {formatCurrency(ind.value)}
                </p>
              </div>
            ))}

            {/* Preço Final - Destaque Máximo */}
            {precoFinalServico !== undefined && precoFinalServico > 0 && (
              <div className="rounded-lg p-4 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 border-2 border-purple-200 dark:border-purple-700">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs text-purple-700 dark:text-purple-300">Preço Final</span>
                </div>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
                  {formatCurrency(precoFinalServico)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Mobile Fixed Bar
  const MobileBar = () => (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary/20 shadow-lg z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full p-3 flex justify-between items-center rounded-none h-auto"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Resumo Financeiro</span>
            </div>
            <div className="flex items-center gap-3">
              {precoFinalServico && precoFinalServico > 0 ? (
                <span className="text-lg font-bold text-purple-600">
                  {formatCurrency(precoFinalServico)}
                </span>
              ) : (
                <span className="text-sm font-medium text-green-600">
                  {formatCurrency(custoFixoMensal)}
                </span>
              )}
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-3 pb-safe">
            <div className="grid grid-cols-3 gap-2">
              {indicadores.map((ind, idx) => (
                <div 
                  key={idx} 
                  className={cn("rounded-lg p-2 text-center", ind.bgColor)}
                >
                  <ind.icon className={cn("h-4 w-4 mx-auto mb-1", ind.color)} />
                  <p className={cn("text-xs font-bold", ind.color)}>
                    {formatCurrency(ind.value)}
                  </p>
                  <span className="text-[10px] text-muted-foreground leading-tight block">
                    {ind.label}
                  </span>
                </div>
              ))}
            </div>
            
            {precoFinalServico !== undefined && precoFinalServico > 0 && (
              <div className="rounded-lg p-3 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 text-center">
                <span className="text-xs text-purple-700 dark:text-purple-300">Preço Final do Serviço</span>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
                  {formatCurrency(precoFinalServico)}
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  return (
    <>
      <DesktopSidebar />
      <MobileBar />
    </>
  );
}
