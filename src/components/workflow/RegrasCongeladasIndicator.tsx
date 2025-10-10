import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Snowflake, Calculator, TrendingUp, Tag, AlertTriangle, Clock } from "lucide-react";
import { RegrasPrecoFotoExtraCongeladas, validarRegrasCongeladas } from "@/utils/precificacaoUtils";
interface RegrasCongeladasIndicatorProps {
  regras?: RegrasPrecoFotoExtraCongeladas;
  compact?: boolean;
}
export function RegrasCongeladasIndicator({
  regras,
  compact = false
}: RegrasCongeladasIndicatorProps) {
  if (!regras) {
    return <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs gap-1 border-orange-200 text-orange-700">
              <Calculator className="h-3 w-3" />
              {!compact && "Migração"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>⚠️ Item sem regras congeladas - será migrado automaticamente</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>;
  }
  const regraValida = validarRegrasCongeladas(regras);
  const getIcon = () => {
    switch (regras.modelo) {
      case 'fixo':
        return <Tag className="h-3 w-3" />;
      case 'global':
        return;
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
  return <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-sm space-y-2">
            <p className="font-medium flex items-center gap-1">
              <Snowflake className="h-3 w-3" />
              Regras Congeladas {!regraValida && '(Inválidas)'}
            </p>
            <p className="text-sm text-muted-foreground">{getDescription()}</p>
            
            {regraValida ? <p className="text-xs text-green-600 bg-green-50 p-2 rounded">
                ✅ Mudanças na configuração não afetam este item
              </p> : <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                ❌ Regras inválidas - migração necessária
              </p>}
            
            <div className="text-xs text-muted-foreground flex items-center gap-1 border-t pt-1">
              <Clock className="h-3 w-3" />
              Congelado: {new Date(regras.timestampCongelamento).toLocaleString('pt-BR')}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>;
}