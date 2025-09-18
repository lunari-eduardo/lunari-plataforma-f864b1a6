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

export const DataFreezingStatus = ({ regrasCongeladas, isCompact = false }: DataFreezingStatusProps) => {
  const hasFrozenData = regrasCongeladas?.modelo === 'completo';
  const hasLegacyData = regrasCongeladas && regrasCongeladas.modelo !== 'completo';
  
  if (!regrasCongeladas) {
    return (
      <TooltipProvider>
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
      </TooltipProvider>
    );
  }

  if (hasFrozenData) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              <Snowflake className="w-3 h-3 mr-1" />
              {isCompact ? "" : "Preservado"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Dados históricos preservados - valores não mudam com alterações de configuração</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (hasLegacyData) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              <Snowflake className="w-3 h-3 mr-1" />
              {isCompact ? "" : "Parcial"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Dados parcialmente preservados - apenas preços de foto extra congelados</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
};