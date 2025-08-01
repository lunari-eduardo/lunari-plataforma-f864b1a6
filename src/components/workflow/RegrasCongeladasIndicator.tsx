import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Snowflake, Calculator, TrendingUp, Tag } from "lucide-react";
import { RegrasPrecoFotoExtraCongeladas } from "@/contexts/AppContext";

interface RegrasCongeladasIndicatorProps {
  regras?: RegrasPrecoFotoExtraCongeladas;
  compact?: boolean;
}

export function RegrasCongeladasIndicator({ regras, compact = false }: RegrasCongeladasIndicatorProps) {
  if (!regras) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs gap-1">
              <Calculator className="h-3 w-3" />
              {!compact && "Atual"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Usando configuração atual (sem regras congeladas)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getIcon = () => {
    switch (regras.modelo) {
      case 'fixo':
        return <Tag className="h-3 w-3" />;
      case 'global':
        return <TrendingUp className="h-3 w-3" />;
      case 'categoria':
        return <Calculator className="h-3 w-3" />;
      default:
        return <Snowflake className="h-3 w-3" />;
    }
  };

  const getLabel = () => {
    if (compact) return regras.modelo.charAt(0).toUpperCase();
    
    switch (regras.modelo) {
      case 'fixo':
        return 'Fixo';
      case 'global':
        return 'Global';
      case 'categoria':
        return 'Categoria';
      default:
        return 'Congelado';
    }
  };

  const getDescription = () => {
    const data = new Date(regras.timestampCongelamento).toLocaleDateString('pt-BR');
    
    switch (regras.modelo) {
      case 'fixo':
        return `Valor fixo: R$ ${regras.valorFixo?.toFixed(2) || '0,00'} (congelado em ${data})`;
      case 'global':
        return `Tabela global: ${regras.tabelaGlobal?.nome || 'N/A'} (congelada em ${data})`;
      case 'categoria':
        return `Tabela da categoria: ${regras.tabelaCategoria?.nome || 'N/A'} (congelada em ${data})`;
      default:
        return `Regras congeladas em ${data}`;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="text-xs gap-1 bg-blue-50 text-blue-700 border-blue-200">
            <Snowflake className="h-3 w-3" />
            {getIcon()}
            {getLabel()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-xs">
            <p className="font-medium">Regras Congeladas</p>
            <p className="text-sm text-muted-foreground">{getDescription()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Mudanças na configuração não afetam este item
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}