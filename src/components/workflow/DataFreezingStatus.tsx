/**
 * Componente para mostrar status de dados congelados
 * Indica se sessão tem dados históricos preservados
 */

import { Badge } from "@/components/ui/badge";
import { Snowflake, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
interface DataFreezingStatusProps {
  regrasCongeladas?: any;
  isCompact?: boolean;
}
export const DataFreezingStatus = ({
  regrasCongeladas,
  isCompact = false
}: DataFreezingStatusProps) => {
  const hasFrozenData = regrasCongeladas?.modelo === 'completo' && regrasCongeladas?.pacote;
  const hasLegacyData = regrasCongeladas && regrasCongeladas.modelo !== 'completo';

  // FASE 2: Badge de ERRO para sessões sem dados congelados completos
  if (!regrasCongeladas || !regrasCongeladas.pacote) {
    return <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className={isCompact ? "h-5 px-1" : ""}>
              <AlertTriangle className="w-3 h-3 mr-1" />
              {!isCompact && "ERRO: Sem Dados"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <div className="space-y-2">
              <p className="font-semibold text-red-500">⚠️ Dados Históricos Ausentes</p>
              <p className="text-sm">
                Esta sessão não possui dados congelados completos. 
                Edições em pacotes/produtos podem afetar esta sessão.
              </p>
              <p className="text-xs text-muted-foreground">
                Clique em "Recongelar Dados" no menu do Workflow.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>;
  }
  if (!regrasCongeladas) {
    return <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {isCompact ? "" : "Dinâmico"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Dados não congelados - valores podem mudar se configurações forem alteradas</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>;
  }
  if (hasFrozenData) {
    return <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            
          </TooltipTrigger>
          <TooltipContent>
            <p>Dados históricos preservados - valores não mudam com alterações de configuração</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>;
  }
  if (hasLegacyData) {
    return <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            
          </TooltipTrigger>
          <TooltipContent>
            <p>Dados parcialmente preservados - apenas preços de foto extra congelados</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>;
  }
  return null;
};