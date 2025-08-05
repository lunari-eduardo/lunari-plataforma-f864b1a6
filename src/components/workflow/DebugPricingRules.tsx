import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bug, RefreshCw, Eye, Calculator } from "lucide-react";
import { debugWorkflowItems, obterConfiguracaoPrecificacao, calcularTotalFotosExtras } from "@/utils/precificacaoUtils";
import { useState } from "react";

interface DebugInfo {
  configAtual: any;
  totalItems: number;
  itemsComRegras: number;
  itemsSemRegras: number;
  modelosEncontrados: string[];
}

export function DebugPricingRules() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const executarDebug = async () => {
    setIsLoading(true);
    
    try {
      // Debug no console
      // Log removido para evitar spam no console
      debugWorkflowItems();
      
      // Coletar informações para UI
      const configAtual = obterConfiguracaoPrecificacao();
      const workflowItems = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
      
      const itemsComRegras = workflowItems.filter((item: any) => item.regrasDePrecoFotoExtraCongeladas);
      const itemsSemRegras = workflowItems.filter((item: any) => !item.regrasDePrecoFotoExtraCongeladas);
      
      const modelosEncontrados = [...new Set(itemsComRegras.map((item: any) => item.regrasDePrecoFotoExtraCongeladas?.modelo).filter(Boolean))] as string[];
      
      setDebugInfo({
        configAtual,
        totalItems: workflowItems.length,
        itemsComRegras: itemsComRegras.length,
        itemsSemRegras: itemsSemRegras.length,
        modelosEncontrados
      });
      
      // Log removido para evitar spam no console
      
    } catch (error) {
      console.error('❌ Erro no debug:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testarCalculo = () => {
    // Log removido para evitar spam no console
    
    // Teste com 10 fotos
    const resultado = calcularTotalFotosExtras(10, { valorFotoExtra: 25 });
    // Log removido para evitar spam no console
    
    console.log('🧮 =================== FIM TESTE ===================');
  };

  const forcarLimpeza = () => {
    if (confirm('⚠️ Isso irá remover TODAS as regras congeladas dos items. Tem certeza?')) {
      try {
        const items = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
        const itemsLimpos = items.map((item: any) => {
          const { regrasDePrecoFotoExtraCongeladas, ...itemSemRegras } = item;
          return itemSemRegras;
        });
        
        localStorage.setItem('workflow_sessions', JSON.stringify(itemsLimpos));
        // Log removido para evitar spam no console
        executarDebug(); // Atualizar debug
      } catch (error) {
        console.error('❌ Erro na limpeza:', error);
      }
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="w-5 h-5" />
          Debug - Sistema de Congelamento
        </CardTitle>
        <CardDescription>
          Ferramentas de diagnóstico para o sistema de regras de preço congeladas
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={executarDebug} 
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <Eye className="w-4 h-4 mr-1" />
            {isLoading ? 'Analisando...' : 'Analisar Items'}
          </Button>
          
          <Button 
            onClick={testarCalculo}
            variant="outline"
            size="sm"
          >
            <Calculator className="w-4 h-4 mr-1" />
            Testar Cálculo
          </Button>
          
          <Button 
            onClick={forcarLimpeza}
            variant="destructive"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Limpar Regras
          </Button>
        </div>

        {debugInfo && (
          <div className="space-y-3 p-3 bg-muted rounded-lg">
            <div>
              <h4 className="font-medium mb-2">Configuração Atual</h4>
              <Badge variant="outline">
                Modelo: {debugInfo.configAtual.modelo}
              </Badge>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total de Items</p>
                <p className="font-medium">{debugInfo.totalItems}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Com Regras Congeladas</p>
                <p className="font-medium text-green-600">{debugInfo.itemsComRegras}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sem Regras (Migração)</p>
                <p className="font-medium text-orange-600">{debugInfo.itemsSemRegras}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Modelos Encontrados</p>
                <div className="flex gap-1 flex-wrap">
                  {debugInfo.modelosEncontrados.map(modelo => (
                    <Badge key={modelo} variant="secondary" className="text-xs">
                      {modelo}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          💡 Use o console do navegador (F12) para ver logs detalhados
        </div>
      </CardContent>
    </Card>
  );
}