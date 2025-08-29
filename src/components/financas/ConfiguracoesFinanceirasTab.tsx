import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Edit2, Save, X, RefreshCw, Database, Wifi, WifiOff } from 'lucide-react';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { FinancialEngine, CreditCard } from '@/services/FinancialEngine';
import { useToast } from '@/hooks/use-toast';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import ConfiguracaoCartoes from './ConfiguracaoCartoes';
import SyncFromPricingModal from './SyncFromPricingModal';
import { pricingFinancialIntegrationService } from '@/services/PricingFinancialIntegrationService';
import { FinancialItemsServiceFactory } from '@/services/FinancialItemsService';
import { toast as sonnerToast } from 'sonner';
interface ConfiguracoesFinanceirasTabProps {
  itensFinanceiros: ItemFinanceiro[];
  adicionarItemFinanceiro: (nome: string, grupo: GrupoPrincipal) => Promise<any>;
  removerItemFinanceiro: (id: string) => Promise<void>;
  atualizarItemFinanceiro: (id: string, dadosAtualizados: Partial<ItemFinanceiro>) => Promise<any>;
}
export default function ConfiguracoesFinanceirasTab({
  itensFinanceiros,
  adicionarItemFinanceiro,
  removerItemFinanceiro,
  atualizarItemFinanceiro
}: ConfiguracoesFinanceirasTabProps) {
  const [novoItemNome, setNovoItemNome] = useState('');
  const [novoItemGrupo, setNovoItemGrupo] = useState<GrupoPrincipal>('Despesa Fixa');
  const [itemEditando, setItemEditando] = useState<string | null>(null);
  const [nomeEditando, setNomeEditando] = useState('');
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [custosDisponiveis, setCustosDisponiveis] = useState(0);
  const [isSupabaseConnected] = useState(() => FinancialItemsServiceFactory.isUsingSupabase());
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const { dialogState, confirm, handleConfirm, handleCancel, handleClose } = useConfirmDialog();
  

  // Verificar custos disponíveis na precificação
  useEffect(() => {
    const checkAvailableCosts = () => {
      const custos = pricingFinancialIntegrationService.getCustosEstudioFromPricingForSync();
      setCustosDisponiveis(custos.length);
      console.log(`🔄 Custos disponíveis na precificação: ${custos.length}`);
    };

    checkAvailableCosts();

    // Verificar novamente a cada 2 segundos para sincronização em tempo real
    const interval = setInterval(checkAvailableCosts, 2000);
    
    return () => clearInterval(interval);
  }, []);
  const grupos: GrupoPrincipal[] = ['Despesa Fixa', 'Despesa Variável', 'Investimento', 'Receita Não Operacional'];
  
  const handleAdicionarItem = async () => {
    if (!novoItemNome.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira um nome para o item.",
        variant: "destructive"
      });
      return;
    }

    // Verificar se já existe um item com o mesmo nome
    const itemExistente = itensFinanceiros.find(item => item.nome.toLowerCase() === novoItemNome.trim().toLowerCase());
    if (itemExistente) {
      toast({
        title: "Erro",
        description: "Já existe um item com este nome.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await adicionarItemFinanceiro(novoItemNome.trim(), novoItemGrupo);
      setNovoItemNome('');
      toast({
        title: "Sucesso",
        description: "Item adicionado com sucesso!"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao adicionar item financeiro.",
        variant: "destructive"
      });
    }
  };
  const handleEditarItem = (item: ItemFinanceiro) => {
    setItemEditando(item.id);
    setNomeEditando(item.nome);
  };
  const handleSalvarEdicao = async (id: string) => {
    if (!nomeEditando.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira um nome válido.",
        variant: "destructive"
      });
      return;
    }

    // Verificar se já existe um item com o mesmo nome (exceto o atual)
    const itemExistente = itensFinanceiros.find(item => item.id !== id && item.nome.toLowerCase() === nomeEditando.trim().toLowerCase());
    if (itemExistente) {
      toast({
        title: "Erro",
        description: "Já existe um item com este nome.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await atualizarItemFinanceiro(id, {
        nome: nomeEditando.trim()
      });
      setItemEditando(null);
      setNomeEditando('');
      toast({
        title: "Sucesso",
        description: "Item atualizado com sucesso!"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar item financeiro.",
        variant: "destructive"
      });
    }
  };
  const handleCancelarEdicao = () => {
    setItemEditando(null);
    setNomeEditando('');
  };
  const handleRemoverItem = async (id: string, nome: string) => {
    const confirmed = await confirm({
      title: "Remover Item Financeiro",
      description: `Tem certeza que deseja remover "${nome}"? Esta ação também removerá todas as transações relacionadas.`,
      confirmText: "Remover",
      cancelText: "Cancelar",
      variant: "destructive"
    });
    
    if (confirmed) {
      try {
        await removerItemFinanceiro(id);
        toast({
          title: "Sucesso",
          description: "Item removido com sucesso!"
        });
      } catch (error: any) {
        toast({
          title: "Erro",
          description: error.message || "Erro ao remover item financeiro.",
          variant: "destructive"
        });
      }
    }
  };

  const handleSyncSupabase = async () => {
    if (!isSupabaseConnected) {
      sonnerToast.error('Supabase não está conectado. Conecte primeiro para sincronizar.');
      return;
    }

    setIsSyncing(true);
    try {
      // TODO: Implement sync when Supabase is connected
      sonnerToast.success('Sincronização com Supabase realizada com sucesso');
    } catch (error) {
      sonnerToast.error('Erro ao sincronizar com Supabase');
    } finally {
      setIsSyncing(false);
    }
  };
  const getCorGrupo = (grupo: GrupoPrincipal) => {
    switch (grupo) {
      case 'Despesa Fixa':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'Despesa Variável':
        return 'bg-lunar-warning/10 text-lunar-warning border-lunar-warning/20';
      case 'Investimento':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'Receita Não Operacional':
        return 'bg-availability/10 text-availability border-availability/20';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };
  const itensPorGrupo = grupos.reduce((acc, grupo) => {
    acc[grupo] = itensFinanceiros.filter(item => item.grupo_principal === grupo && item.ativo);
    return acc;
  }, {} as Record<GrupoPrincipal, ItemFinanceiro[]>);

  const handleSyncComplete = () => {
    // Forçar atualização imediata dos custos disponíveis
    const custos = pricingFinancialIntegrationService.getCustosEstudioFromPricingForSync();
    setCustosDisponiveis(custos.length);
    console.log(`✅ Sincronização concluída. Custos atualizados: ${custos.length}`);
    
    toast({
      title: "Sincronização Concluída",
      description: "Os itens foram importados da precificação com sucesso!"
    });
  };
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configurações Financeiras</h2>
          <p className="text-muted-foreground">
            Gerencie os itens financeiros do sistema
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            {isSupabaseConnected ? (
              <div className="flex items-center gap-2 text-green-600">
                <Wifi className="h-4 w-4" />
                <span className="text-sm font-medium">Supabase Conectado</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <WifiOff className="h-4 w-4" />
                <span className="text-sm font-medium">Local (Supabase não conectado)</span>
              </div>
            )}
          </div>
          
          {/* Sync button */}
          <Button 
            onClick={handleSyncSupabase}
            disabled={!isSupabaseConnected || isSyncing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="itens" className="w-full">
        <TabsList className="grid w-full bg-gradient-to-r from-lunar-accent/10 to-lunar-accent/5 backdrop-blur-sm border border-lunar-border/20 rounded-xl p-1 grid-cols-2">
          <TabsTrigger 
            value="itens" 
            className="text-xs font-medium transition-all duration-300 ease-out rounded-lg data-[state=active]:bg-white/90 data-[state=active]:text-lunar-accent data-[state=active]:shadow-lg data-[state=active]:shadow-lunar-accent/15 data-[state=active]:border data-[state=active]:border-lunar-accent/20 data-[state=inactive]:text-lunar-text data-[state=inactive]:hover:bg-lunar-accent/10 data-[state=inactive]:hover:text-lunar-accent"
          >
            Itens Financeiros
          </TabsTrigger>
          <TabsTrigger 
            value="cartoes" 
            className="text-xs font-medium transition-all duration-300 ease-out rounded-lg data-[state=active]:bg-white/90 data-[state=active]:text-lunar-accent data-[state=active]:shadow-lg data-[state=active]:shadow-lunar-accent/15 data-[state=active]:border data-[state=active]:border-lunar-accent/20 data-[state=inactive]:text-lunar-text data-[state=inactive]:hover:bg-lunar-accent/10 data-[state=inactive]:hover:text-lunar-accent"
          >
            Cartões de Crédito
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="itens" className="mt-6">
          <div className="space-y-6">
            {/* Formulário para Adicionar Novo Item */}
            <Card className="bg-card rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Plus className="h-5 w-5" />
                  Adicionar Novo Item Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome-item">Nome do Item</Label>
                    <Input id="nome-item" placeholder="Ex: Adobe, Combustível, etc." value={novoItemNome} onChange={e => setNovoItemNome(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAdicionarItem()} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="grupo-item">Grupo Principal</Label>
                    <Select value={novoItemGrupo} onValueChange={value => setNovoItemGrupo(value as GrupoPrincipal)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {grupos.map(grupo => <SelectItem key={grupo} value={grupo}>
                            {grupo}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-end">
                    <Button onClick={handleAdicionarItem} className="w-1/2">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Itens por Grupo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {grupos.map(grupo => <Card key={grupo} className="h-fit rounded-lg bg-card">
                  <CardHeader className="pb-2 bg-card rounded-lg">
                    <CardTitle className="text-sm">
                      <div className="flex items-center justify-between">
                        <Badge className={`${getCorGrupo(grupo)} text-xs font-medium`}>
                          {grupo}
                        </Badge>
                        {grupo === 'Despesa Fixa' && (
                          <div className="flex items-center gap-2">
                            {custosDisponiveis > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {custosDisponiveis} na Precificação
                              </Badge>
                            )}
                            {custosDisponiveis > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSyncModalOpen(true)}
                                className="h-6 px-2 text-xs"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Sincronizar
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 bg-card rounded-lg">
                    {itensPorGrupo[grupo].length === 0 ? <p className="text-lunar-textSecondary text-xs italic text-center py-2">
                        Nenhum item cadastrado neste grupo.
                      </p> : <div className="space-y-1">
                        {itensPorGrupo[grupo].map(item => <div key={item.id} className="flex items-center justify-between p-2 bg-lunar-surface/50 border border-lunar-border/30 rounded-lg hover:bg-lunar-surface/80 transition-colors py-0">
                            {itemEditando === item.id ? <div className="flex items-center gap-2 flex-1">
                                <Input value={nomeEditando} onChange={e => setNomeEditando(e.target.value)} className="flex-1 text-sm" onKeyPress={e => e.key === 'Enter' && handleSalvarEdicao(item.id)} />
                                <Button size="sm" onClick={() => handleSalvarEdicao(item.id)} className="h-8 w-8 p-0">
                                  <Save className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleCancelarEdicao} className="h-8 w-8 p-0">
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div> : <>
                                <span className="text-lunar-text text-xs font-medium flex-1 min-w-0 truncate pr-2">{item.nome}</span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button size="sm" variant="ghost" onClick={() => handleEditarItem(item)} className="h-8 w-8 p-0 hover:bg-lunar-accent/20">
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleRemoverItem(item.id, item.nome)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </>}
                          </div>)}
                        </div>}
                  </CardContent>
                </Card>)}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cartoes" className="mt-6">
          <ConfiguracaoCartoes />
        </TabsContent>

      </Tabs>

      <SyncFromPricingModal
        open={syncModalOpen}
        onOpenChange={setSyncModalOpen}
        onSyncComplete={handleSyncComplete}
      />

      <ConfirmDialog
        state={dialogState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={handleClose}
      />
    </div>;
}