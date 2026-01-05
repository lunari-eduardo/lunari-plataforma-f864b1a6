import { useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import ConfiguracaoCartoes from './ConfiguracaoCartoes';
import SyncFromPricingModal from './SyncFromPricingModal';
import { supabaseFinancialItemsService } from '@/services/FinancialItemsService';
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
  // Specialized hooks for different concerns
  const itemsManagement = useFinancialItemsManagement({
    itensFinanceiros,
    adicionarItemFinanceiro,
    removerItemFinanceiro,
    atualizarItemFinanceiro
  });

  const pricingSync = usePricingSync();
  const { dialogState, confirm, handleConfirm, handleCancel, handleClose } = useConfirmDialog();

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
      <FinancialConfigHeader />

      <Tabs defaultValue="itens" className="w-full">
        <TabsList className="inline-flex p-1 bg-muted/50 border border-border rounded-lg">
          <TabsTrigger 
            value="itens" 
            className="px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/50"
          >
            Itens Financeiros
          </TabsTrigger>
          <TabsTrigger 
            value="cartoes" 
            className="px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/50"
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