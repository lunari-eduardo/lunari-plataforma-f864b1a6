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
    },
    {
      label: 'Custo da Hora',
      value: custoHora,
      icon: Clock,
    },
    {
      label: 'Meta Mensal',
      value: metaFaturamentoMensal,
      icon: Target,
    }
  ];

  // Desktop Sidebar - cores neutras
  const DesktopSidebar = () => (
    <div className="hidden lg:block sticky top-4 w-72 h-fit">
      <Card className="border bg-card">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-foreground" />
            </div>
            <h3 className="font-semibold text-sm">Resumo Financeiro</h3>
          </div>

          <div className="space-y-3">
            {indicadores.map((ind, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "rounded-lg p-3 bg-muted/50",
                  isCalculating && "animate-pulse"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ind.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{ind.label}</span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(ind.value)}
                </p>
              </div>
            ))}

            {/* Preço Final - Único destaque com cor primary */}
            {precoFinalServico !== undefined && precoFinalServico > 0 && (
              <div className="rounded-lg p-4 bg-muted/50 border-2 border-primary">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Preço Final</span>
                </div>
                <p className="text-2xl font-black text-primary">
                  {formatCurrency(precoFinalServico)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Mobile Fixed Bar - Posicionado ACIMA do menu (bottom-16)
  const MobileBar = () => (
    <div className="lg:hidden fixed bottom-16 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg z-30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full p-3 flex justify-between items-center rounded-none h-auto"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-foreground" />
              <span className="font-medium text-sm">Resumo Financeiro</span>
            </div>
            <div className="flex items-center gap-3">
              {precoFinalServico && precoFinalServico > 0 ? (
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(precoFinalServico)}
                </span>
              ) : (
                <span className="text-sm font-medium text-foreground">
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
                  className="rounded-lg p-2 text-center bg-muted/50"
                >
                  <ind.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs font-bold text-foreground">
                    {formatCurrency(ind.value)}
                  </p>
                  <span className="text-[10px] text-muted-foreground leading-tight block">
                    {ind.label}
                  </span>
                </div>
              ))}
            </div>
            
            {precoFinalServico !== undefined && precoFinalServico > 0 && (
              <div className="rounded-lg p-3 bg-muted/50 border-2 border-primary text-center">
                <span className="text-xs text-muted-foreground">Preço Final do Serviço</span>
                <p className="text-2xl font-black text-primary">
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
