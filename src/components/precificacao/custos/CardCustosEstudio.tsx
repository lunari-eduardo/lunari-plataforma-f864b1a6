import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, ChevronDown, Plus, Trash2, RefreshCw, ArrowLeftRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { pricingFinancialIntegrationService, type SyncPreview } from '@/services/PricingFinancialIntegrationService';
import type { GastoItem } from '@/types/precificacao';
import { cn } from '@/lib/utils';

interface CardCustosEstudioProps {
  custosEstudio: GastoItem[];
  setCustosEstudio: React.Dispatch<React.SetStateAction<GastoItem[]>>;
  totalCustosEstudio: number;
}

export function CardCustosEstudio({
  custosEstudio,
  setCustosEstudio,
  totalCustosEstudio
}: CardCustosEstudioProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [novoCusto, setNovoCusto] = useState({ descricao: '', valor: '' });
  
  // Estados para sincronização
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncPreview, setSyncPreview] = useState<SyncPreview[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isLoadingSync, setIsLoadingSync] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const adicionarCusto = () => {
    if (novoCusto.descricao && novoCusto.valor) {
      setCustosEstudio(prev => [...prev, {
        id: Date.now().toString(),
        descricao: novoCusto.descricao,
        valor: parseFloat(novoCusto.valor) || 0
      }]);
      setNovoCusto({ descricao: '', valor: '' });
    }
  };

  const atualizarCusto = (id: string, campo: keyof GastoItem, valor: any) => {
    setCustosEstudio(prev => prev.map(item => 
      item.id === id ? { ...item, [campo]: valor } : item
    ));
  };

  const removerCusto = (id: string) => {
    setCustosEstudio(prev => prev.filter(item => item.id !== id));
  };

  // Funções de sincronização
  const openSyncDialog = async () => {
    setIsLoadingSync(true);
    try {
      const preview = pricingFinancialIntegrationService.generateSyncPreview();
      setSyncPreview(preview);
      setSelectedItems(preview.filter(p => p.acao !== 'manter').map(p => p.item.id));
      setSyncDialogOpen(true);
    } catch (error) {
      console.error('Erro ao gerar preview:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do financeiro.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingSync(false);
    }
  };

  const executeSyncronization = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Nenhum item selecionado",
        description: "Selecione pelo menos um item para sincronizar.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoadingSync(true);
    try {
      const result = pricingFinancialIntegrationService.executeSyncronization(selectedItems, true);
      if (result.success) {
        const custosAtualizados = pricingFinancialIntegrationService.getCustosEstudioFromPricing();
        setCustosEstudio(custosAtualizados.map(custo => ({
          id: custo.id,
          descricao: custo.descricao,
          valor: custo.valor
        })));
        toast({
          title: "Sincronização concluída",
          description: `${result.imported} itens importados, ${result.updated} itens atualizados.`
        });
        setSyncDialogOpen(false);
      } else {
        toast({
          title: "Erro na sincronização",
          description: result.errors.join(', '),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro durante sincronização:', error);
      toast({
        title: "Erro",
        description: "Falha durante a sincronização.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingSync(false);
    }
  };

  return (
    <Card className="overflow-hidden shadow-sm border-2 hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-800 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-base">Custos do Estúdio</CardTitle>
          </div>
          <Badge variant="outline" className="text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700 font-bold">
            {formatCurrency(totalCustosEstudio)}
          </Badge>
        </div>
      </CardHeader>
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between rounded-none border-t h-10 hover:bg-muted/50"
          >
            <span className="text-sm text-muted-foreground">
              {custosEstudio.length} {custosEstudio.length === 1 ? 'custo' : 'custos'} cadastrados
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-4 space-y-4">
            {/* Botão de sincronização */}
            <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={openSyncDialog} 
                  variant="outline" 
                  size="sm"
                  disabled={isLoadingSync}
                  className="w-full text-orange-600 border-orange-200 hover:bg-orange-50"
                >
                  {isLoadingSync ? (
                    <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full mr-2" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-2" />
                  )}
                  Sincronizar com Finanças
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    Sincronizar com Finanças
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Importe despesas fixas do sistema financeiro para a precificação.
                    </p>
                  </div>

                  {syncPreview.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Nenhuma despesa fixa encontrada no sistema financeiro.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Checkbox 
                          checked={selectedItems.length === syncPreview.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedItems(syncPreview.map(p => p.item.id));
                            } else {
                              setSelectedItems([]);
                            }
                          }}
                        />
                        <Label className="text-sm font-medium">
                          Selecionar todos ({syncPreview.length} itens)
                        </Label>
                      </div>

                      {syncPreview.map(preview => (
                        <div key={preview.item.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-3">
                            <Checkbox 
                              checked={selectedItems.includes(preview.item.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedItems(prev => [...prev, preview.item.id]);
                                } else {
                                  setSelectedItems(prev => prev.filter(id => id !== preview.item.id));
                                }
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{preview.item.nome}</span>
                                <Badge variant={
                                  preview.acao === 'adicionar' ? 'default' : 
                                  preview.acao === 'atualizar' ? 'secondary' : 'outline'
                                }>
                                  {preview.acao === 'adicionar' ? 'Novo' : 
                                   preview.acao === 'atualizar' ? 'Atualizar' : 'Manter'}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Valor médio: {formatCurrency(preview.valorFinanceiro)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={executeSyncronization}
                      disabled={selectedItems.length === 0 || isLoadingSync}
                    >
                      {isLoadingSync && (
                        <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full mr-2" />
                      )}
                      Sincronizar ({selectedItems.length})
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Formulário de adição rápida */}
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <Input 
                    placeholder="Ex: Aluguel, Energia, Internet..." 
                    value={novoCusto.descricao}
                    onChange={e => setNovoCusto(prev => ({ ...prev, descricao: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    step="0.01"
                    placeholder="0,00" 
                    value={novoCusto.valor}
                    onChange={e => setNovoCusto(prev => ({ ...prev, valor: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>
              <Button 
                onClick={adicionarCusto} 
                disabled={!novoCusto.descricao || !novoCusto.valor}
                className="w-full mt-3 h-9"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Custo
              </Button>
            </div>

            {/* Lista de custos */}
            <div className="space-y-2">
              {custosEstudio.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum custo do estúdio cadastrado
                </p>
              ) : (
                custosEstudio.map(custo => (
                  <div 
                    key={custo.id} 
                    className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <Input 
                      value={custo.descricao}
                      onChange={e => atualizarCusto(custo.id, 'descricao', e.target.value)}
                      className="flex-1 h-8 text-sm border-0 bg-transparent focus-visible:ring-1"
                      placeholder="Descrição"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <Input 
                        type="number"
                        min="0"
                        step="0.01"
                        value={custo.valor}
                        onChange={e => atualizarCusto(custo.id, 'valor', parseFloat(e.target.value) || 0)}
                        className="w-24 h-8 text-sm text-right border-0 bg-transparent focus-visible:ring-1"
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removerCusto(custo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
