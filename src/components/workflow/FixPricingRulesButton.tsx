import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, CheckCircle } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { migrarRegrasParaItemAntigo, calcularComRegrasProprias, formatarMoeda } from "@/utils/precificacaoUtils";
import { useState } from "react";

export function FixPricingRulesButton() {
  const { workflowItems, updateWorkflowItem } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processed, setProcessed] = useState(0);

  // Contar items sem regras congeladas
  const itemsSemRegras = workflowItems.filter(item => !item.regrasDePrecoFotoExtraCongeladas);
  const totalItems = workflowItems.length;

  const corrigirTodosItems = async () => {
    setIsProcessing(true);
    setProcessed(0);

    console.log('🔧 [CORREÇÃO] Iniciando correção de todos os items...');

    for (let i = 0; i < workflowItems.length; i++) {
      const item = workflowItems[i];
      
      if (!item.regrasDePrecoFotoExtraCongeladas) {
        console.log(`🔄 [CORREÇÃO] Migrando item ${i + 1}/${workflowItems.length}:`, item.id);
        
        // Preservar valor original
        const valorOriginalStr = typeof item.valorFotoExtra === 'string' ? item.valorFotoExtra : 'R$ 35,00';
        const valorOriginal = parseFloat(valorOriginalStr.replace(/[^\d,]/g, '').replace(',', '.')) || 35;
        
        // Criar regras congeladas
        const regrasCongeladas = migrarRegrasParaItemAntigo(valorOriginal);
        
        // Recalcular valor total se tem fotos extras
        let updates: any = {
          regrasDePrecoFotoExtraCongeladas: regrasCongeladas,
          valorFotoExtra: formatarMoeda(valorOriginal)
        };
        
        if (item.qtdFotoExtra && item.qtdFotoExtra > 0) {
          const valorTotalCalculado = calcularComRegrasProprias(item.qtdFotoExtra, regrasCongeladas);
          updates.valorTotalFotoExtra = formatarMoeda(valorTotalCalculado);
        }
        
        // Aplicar as atualizações
        updateWorkflowItem(item.id, updates);
        
        console.log(`✅ [CORREÇÃO] Item migrado:`, item.id, updates);
      } else {
        console.log(`✓ [CORREÇÃO] Item já possui regras:`, item.id, item.regrasDePrecoFotoExtraCongeladas.modelo);
      }
      
      setProcessed(i + 1);
      
      // Delay pequeno para não travar a UI
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    console.log('🎉 [CORREÇÃO] Processo concluído!');
    
    // Mostrar feedback por alguns segundos
    setTimeout(() => {
      setIsProcessing(false);
      setProcessed(0);
    }, 2000);
  };

  if (totalItems === 0) {
    return (
      <Badge variant="outline" className="text-xs">
        Nenhum item encontrado
      </Badge>
    );
  }

  if (itemsSemRegras.length === 0) {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <CheckCircle className="h-3 w-3" />
        Todos os items corrigidos
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="destructive" className="text-xs">
        {itemsSemRegras.length} items sem regras congeladas
      </Badge>
      
      <Button
        onClick={corrigirTodosItems}
        disabled={isProcessing}
        variant="outline"
        size="sm"
        className="h-7"
      >
        <RotateCcw className={`h-3 w-3 mr-1 ${isProcessing ? 'animate-spin' : ''}`} />
        {isProcessing ? `Corrigindo... ${processed}/${totalItems}` : 'Corrigir Todos'}
      </Button>
    </div>
  );
}