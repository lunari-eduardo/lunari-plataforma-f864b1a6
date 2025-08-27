import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { pricingFinancialIntegrationService } from '@/services/PricingFinancialIntegrationService';

interface SyncFromPricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete: () => void;
}

export default function SyncFromPricingModal({
  open,
  onOpenChange,
  onSyncComplete
}: SyncFromPricingModalProps) {
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  // Carregar preview quando modal abrir
  useEffect(() => {
    if (open) {
      setLoading(true);
      try {
        const preview = pricingFinancialIntegrationService.generateReverseSyncPreview();
        setPreviewItems(preview);
        
        // Pré-selecionar apenas itens que podem ser adicionados
        const itemsParaAdicionar = preview
          .filter(item => item.acao === 'adicionar')
          .map(item => item.custo.id);
        setSelectedItems(itemsParaAdicionar);
      } catch (error) {
        console.error('Erro ao gerar preview:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar custos da precificação.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }
  }, [open, toast]);

  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    const itemsDisponiveis = previewItems
      .filter(item => item.acao !== 'existe')
      .map(item => item.custo.id);
    
    if (selectedItems.length === itemsDisponiveis.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(itemsDisponiveis);
    }
  };

  const handleSync = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione pelo menos um item para sincronizar.",
        variant: "destructive"
      });
      return;
    }

    setSyncing(true);
    try {
      const resultado = pricingFinancialIntegrationService.executeReverseSyncronization(selectedItems);
      
      if (resultado.success) {
        toast({
          title: "Sincronização Concluída",
          description: `${resultado.created} itens criados no sistema financeiro.`
        });
        onSyncComplete();
        onOpenChange(false);
      } else {
        toast({
          title: "Erro na Sincronização",
          description: resultado.errors.join(', '),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro durante sincronização:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado durante a sincronização.",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const getActionIcon = (acao: string) => {
    switch (acao) {
      case 'adicionar':
        return <Plus className="h-4 w-4 text-availability" />;
      case 'existe':
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertCircle className="h-4 w-4 text-lunar-warning" />;
    }
  };

  const getActionText = (acao: string) => {
    switch (acao) {
      case 'adicionar':
        return 'Adicionar';
      case 'existe':
        return 'Já existe';
      default:
        return 'Atualizar';
    }
  };

  const getActionBadgeClass = (acao: string) => {
    switch (acao) {
      case 'adicionar':
        return 'bg-availability/10 text-availability border-availability/20';
      case 'existe':
        return 'bg-muted/50 text-muted-foreground border-muted/30';
      default:
        return 'bg-lunar-warning/10 text-lunar-warning border-lunar-warning/20';
    }
  };

  const itemsDisponiveis = previewItems.filter(item => item.acao !== 'existe');
  const itemsJaExistentes = previewItems.filter(item => item.acao === 'existe');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              🔄
            </span>
            Sincronizar da Precificação
          </DialogTitle>
          <DialogDescription>
            Importe custos do estúdio da precificação para criar despesas fixas no sistema financeiro.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando custos...</span>
            </div>
          ) : (
            <>
              {/* Resumo */}
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-availability">
                        {itemsDisponiveis.length}
                      </div>
                      <div className="text-xs text-muted-foreground">Disponíveis</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-primary">
                        {selectedItems.length}
                      </div>
                      <div className="text-xs text-muted-foreground">Selecionados</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-muted-foreground">
                        {itemsJaExistentes.length}
                      </div>
                      <div className="text-xs text-muted-foreground">Já existem</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Controles de Seleção */}
              {itemsDisponiveis.length > 0 && (
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-xs"
                  >
                    {selectedItems.length === itemsDisponiveis.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    {selectedItems.length} de {itemsDisponiveis.length} selecionados
                  </div>
                </div>
              )}

              {/* Lista de Itens */}
              <div className="space-y-2">
                {previewItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum custo encontrado na precificação.</p>
                    <p className="text-xs mt-1">Cadastre custos do estúdio na aba Precificação primeiro.</p>
                  </div>
                ) : (
                  previewItems.map((item) => (
                    <div
                      key={item.custo.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        item.acao === 'existe' 
                          ? 'bg-muted/30 border-muted/30' 
                          : selectedItems.includes(item.custo.id)
                            ? 'bg-primary/5 border-primary/20'
                            : 'bg-card border-border hover:border-primary/30'
                      }`}
                    >
                      {item.acao !== 'existe' && (
                        <Checkbox
                          checked={selectedItems.includes(item.custo.id)}
                          onCheckedChange={() => handleToggleItem(item.custo.id)}
                        />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {item.custo.descricao}
                          </span>
                          <Badge className={`text-xs ${getActionBadgeClass(item.acao)}`}>
                            {getActionIcon(item.acao)}
                            <span className="ml-1">{getActionText(item.acao)}</span>
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Valor: R$ {item.custo.valor.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSync}
            disabled={selectedItems.length === 0 || syncing}
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              `Sincronizar ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}