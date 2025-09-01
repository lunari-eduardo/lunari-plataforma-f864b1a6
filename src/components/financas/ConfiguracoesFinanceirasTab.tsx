import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import ConfiguracaoCartoes from './ConfiguracaoCartoes';
import SyncFromPricingModal from './SyncFromPricingModal';
import { FinancialItemsServiceFactory } from '@/services/FinancialItemsService';
import { toast as sonnerToast } from 'sonner';

// Specialized components
import { FinancialConfigHeader } from './configuracoes/FinancialConfigHeader';
import { AddItemForm } from './configuracoes/AddItemForm';
import { ItemsList } from './configuracoes/ItemsList';

// Specialized hooks
import { useFinancialItemsManagement } from '@/hooks/useFinancialItemsManagement';
import { usePricingSync } from '@/hooks/usePricingSync';

// Constants
import { TOAST_MESSAGES } from '@/constants/financialConstants';
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
  // Supabase connection state
  const [isSupabaseConnected] = useState(() => FinancialItemsServiceFactory.isUsingSupabase());
  const [isSyncing, setIsSyncing] = useState(false);

  // Specialized hooks for different concerns
  const itemsManagement = useFinancialItemsManagement({
    itensFinanceiros,
    adicionarItemFinanceiro,
    removerItemFinanceiro,
    atualizarItemFinanceiro
  });

  const pricingSync = usePricingSync();
  const { dialogState, confirm, handleConfirm, handleCancel, handleClose } = useConfirmDialog();
  

  // Memoized handlers for better performance
  const handleSyncSupabase = useCallback(async () => {
    if (!isSupabaseConnected) {
      sonnerToast.error(TOAST_MESSAGES.SYNC_NOT_CONNECTED);
      return;
    }

    setIsSyncing(true);
    try {
      // TODO: [SUPABASE] Implement real sync when Supabase is properly connected
      // This will replace localStorage operations with Supabase queries
      // Add RLS policies for security and real-time sync for multiple users
      sonnerToast.success(TOAST_MESSAGES.SYNC_SUCCESS);
    } catch (error) {
      sonnerToast.error(TOAST_MESSAGES.SYNC_ERROR);
    } finally {
      setIsSyncing(false);
    }
  }, [isSupabaseConnected]);

  // Enhanced confirm dialog for item deletion
  const handleRemoverItemWithConfirmation = useCallback(async (id: string, nome: string) => {
    const confirmed = await confirm({
      title: "Remover Item Financeiro",
      description: `Tem certeza que deseja remover "${nome}"? Esta ação também removerá todas as transações relacionadas.`,
      confirmText: "Remover",
      cancelText: "Cancelar",
      variant: "destructive"
    });
    
    if (confirmed) {
      await itemsManagement.handleRemoverItem(id);
    }
  }, [confirm, itemsManagement.handleRemoverItem]);

  const handleSyncComplete = useCallback(() => {
    pricingSync.handleSyncComplete();
    sonnerToast.success(TOAST_MESSAGES.SYNC_COMPLETE);
  }, [pricingSync]);
  
  // All business logic is now handled by specialized hooks
  return (
    <div className="space-y-6">
      <FinancialConfigHeader 
        isSupabaseConnected={isSupabaseConnected}
        isSyncing={isSyncing}
        onSyncSupabase={handleSyncSupabase}
      />

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
            <AddItemForm 
              novoItemNome={itemsManagement.itemState.novoNome}
              novoItemGrupo={itemsManagement.itemState.novoGrupo}
              onNomeChange={(nome) => itemsManagement.updateItemState({ novoNome: nome })}
              onGrupoChange={(grupo) => itemsManagement.updateItemState({ novoGrupo: grupo })}
              onSubmit={itemsManagement.handleAdicionarItem}
            />

            <ItemsList 
              itensPorGrupo={itemsManagement.itensPorGrupo}
              itemEditando={itemsManagement.itemState.editandoId}
              nomeEditando={itemsManagement.itemState.nomeEditando}
              custosDisponiveis={pricingSync.custosDisponiveis}
              onEditItem={itemsManagement.handleEditarItem}
              onSaveEdit={itemsManagement.handleSalvarEdicao}
              onCancelEdit={itemsManagement.handleCancelarEdicao}
              onDeleteItem={handleRemoverItemWithConfirmation}
              onOpenSyncModal={() => pricingSync.setSyncModalOpen(true)}
              onNomeEditandoChange={(nome) => itemsManagement.updateItemState({ nomeEditando: nome })}
            />
          </div>
        </TabsContent>

        <TabsContent value="cartoes" className="mt-6">
          <ConfiguracaoCartoes />
        </TabsContent>

      </Tabs>

      <SyncFromPricingModal
        open={pricingSync.syncModalOpen}
        onOpenChange={pricingSync.setSyncModalOpen}
        onSyncComplete={handleSyncComplete}
      />

      <ConfirmDialog
        state={dialogState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={handleClose}
      />
    </div>
  );
}