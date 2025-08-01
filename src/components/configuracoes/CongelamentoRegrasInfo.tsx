import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Snowflake, Info, Shield } from "lucide-react";

export function CongelamentoRegrasInfo() {
  return (
    <Alert className="border-blue-200 bg-blue-50">
      <Snowflake className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800 flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Sistema de Congelamento de Regras
      </AlertTitle>
      <AlertDescription className="text-blue-700 space-y-2">
        <p>
          Mudanças nesta configuração <strong>NÃO AFETAM</strong> projetos já existentes no Workflow.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            <Info className="h-3 w-3 mr-1" />
            Proteção automática
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Snowflake className="h-3 w-3 mr-1" />
            Regras congeladas
          </Badge>
        </div>
        <p className="text-sm">
          Cada projeto preserva as regras de precificação que estavam ativas quando foi criado,
          garantindo consistência nos cálculos independente de mudanças futuras.
        </p>
      </AlertDescription>
    </Alert>
  );
}