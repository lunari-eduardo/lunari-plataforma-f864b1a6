/**
 * CONFIGURAÇÕES FINANCEIRAS TAB - REFATORADO
 * 
 * Componente principal para gerenciar configurações do sistema financeiro.
 * Organizado em seções especializadas para melhor manutenibilidade.
 */

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, CreditCard } from 'lucide-react';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';

// Componentes especializados
import FinancialItemsSection from './configuracoes/FinancialItemsSection';
import CreditCardsSection from './configuracoes/CreditCardsSection';
import SyncSection from './configuracoes/SyncSection';
import SyncFromPricingModal from './SyncFromPricingModal';

// Context para cartões (assumindo que vem do AppContext)
import { useAppContext } from '@/contexts/AppContext';
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

  // ============= ESTADO LOCAL =============
  
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const { toast } = useToast();
  const { dialogState, confirm, handleConfirm, handleCancel, handleClose } = useConfirmDialog();

  // ============= CONTEXT =============
  
  const {
    cartoes,
    adicionarCartao,
    removerCartao
  } = useAppContext();

  // ============= HANDLERS =============
  
  const handleSyncComplete = () => {
    toast({
      title: "Sincronização Concluída",
      description: "Os itens foram importados da precificação com sucesso!"
    });
  };
  // ============= RENDER =============
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configurações Financeiras</h2>
          <p className="text-muted-foreground">
            Gerencie os itens financeiros e configurações do sistema
          </p>
        </div>
      </div>

      <Tabs defaultValue="itens" className="w-full">
        <TabsList className="grid w-full bg-gradient-to-r from-lunar-accent/10 to-lunar-accent/5 backdrop-blur-sm border border-lunar-border/20 rounded-xl p-1 grid-cols-3">
          <TabsTrigger 
            value="itens" 
            className="text-xs font-medium transition-all duration-300 ease-out rounded-lg data-[state=active]:bg-white/90 data-[state=active]:text-lunar-accent data-[state=active]:shadow-lg data-[state=active]:shadow-lunar-accent/15 data-[state=active]:border data-[state=active]:border-lunar-accent/20 data-[state=inactive]:text-lunar-text data-[state=inactive]:hover:bg-lunar-accent/10 data-[state=inactive]:hover:text-lunar-accent"
          >
            <Database className="h-4 w-4 mr-1" />
            Itens Financeiros
          </TabsTrigger>
          <TabsTrigger 
            value="cartoes" 
            className="text-xs font-medium transition-all duration-300 ease-out rounded-lg data-[state=active]:bg-white/90 data-[state=active]:text-lunar-accent data-[state=active]:shadow-lg data-[state=active]:shadow-lunar-accent/15 data-[state=active]:border data-[state=active]:border-lunar-accent/20 data-[state=inactive]:text-lunar-text data-[state=inactive]:hover:bg-lunar-accent/10 data-[state=inactive]:hover:text-lunar-accent"
          >
            <CreditCard className="h-4 w-4 mr-1" />
            Cartões de Crédito
          </TabsTrigger>
          <TabsTrigger 
            value="sync" 
            className="text-xs font-medium transition-all duration-300 ease-out rounded-lg data-[state=active]:bg-white/90 data-[state=active]:text-lunar-accent data-[state=active]:shadow-lg data-[state=active]:shadow-lunar-accent/15 data-[state=active]:border data-[state=active]:border-lunar-accent/20 data-[state=inactive]:text-lunar-text data-[state=inactive]:hover:bg-lunar-accent/10 data-[state=inactive]:hover:text-lunar-accent"
          >
            Sincronização
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="itens" className="mt-6">
          <FinancialItemsSection
            itensFinanceiros={itensFinanceiros}
            adicionarItemFinanceiro={adicionarItemFinanceiro}
            removerItemFinanceiro={removerItemFinanceiro}
            atualizarItemFinanceiro={atualizarItemFinanceiro}
            onSyncModalOpen={() => setSyncModalOpen(true)}
          />
        </TabsContent>

        <TabsContent value="cartoes" className="mt-6">
          <CreditCardsSection
            cartoes={cartoes}
            adicionarCartao={adicionarCartao}
            removerCartao={removerCartao}
          />
        </TabsContent>

        <TabsContent value="sync" className="mt-6">
          <SyncSection
            onSyncModalOpen={() => setSyncModalOpen(true)}
          />
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
    </div>
  );
}