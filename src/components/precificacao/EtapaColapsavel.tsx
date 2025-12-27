import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusSalvamento } from '@/types/precificacao';

interface EtapaColapsavelProps {
  numero: number;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  statusSalvamento?: StatusSalvamento;
}

export function EtapaColapsavel({
  numero,
  titulo,
  descricao,
  children,
  defaultOpen = true,
  statusSalvamento
}: EtapaColapsavelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-foreground">
            {numero}
          </div>
          <div className="flex-1 text-left">
            <h2 className="font-semibold text-foreground">{titulo}</h2>
            <p className="text-sm text-muted-foreground">{descricao}</p>
          </div>
          
          {/* Status de salvamento */}
          {statusSalvamento && (
            <div className="flex items-center gap-1 text-xs mr-2">
              {statusSalvamento === 'salvo' && <CheckCircle className="h-3 w-3 text-green-600" />}
              {statusSalvamento === 'erro' && <AlertCircle className="h-3 w-3 text-destructive" />}
              {statusSalvamento === 'salvando' && (
                <div className="animate-spin h-3 w-3 border border-primary border-t-transparent rounded-full" />
              )}
            </div>
          )}
          
          <ChevronDown className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="pt-4 space-y-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
