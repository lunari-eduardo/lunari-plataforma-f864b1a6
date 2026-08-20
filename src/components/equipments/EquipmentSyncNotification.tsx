import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Plus, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { EQUIPMENT_SYNC_EVENT, type EquipmentCandidate, markTransactionAsProcessed } from '@/hooks/useEquipmentSync';
import { EquipmentSyncModal } from './EquipmentSyncModal';
import { supabase } from '@/integrations/supabase/client';

interface QueuedEquipment extends EquipmentCandidate {
  id: string;
  timestamp: number;
}

export function EquipmentSyncNotification() {
  const navigate = useNavigate();
  const [queuedEquipments, setQueuedEquipments] = useState<QueuedEquipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<QueuedEquipment | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const handleEquipmentCandidate = (event: any) => {
      const candidate = event.detail as EquipmentCandidate;
      const queuedEquipment: QueuedEquipment = {
        ...candidate,
        id: `eq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };
      setQueuedEquipments(prev => {
        // Evitar duplicatas baseado no transacaoId
        if (prev.some(eq => eq.transacaoId === candidate.transacaoId)) {
          return prev;
        }
        return [queuedEquipment, ...prev];
      });
      console.log('🔧 [EquipmentNotification] Novo equipamento na fila:', queuedEquipment);
    };
    window.addEventListener(EQUIPMENT_SYNC_EVENT, handleEquipmentCandidate);
    return () => {
      window.removeEventListener(EQUIPMENT_SYNC_EVENT, handleEquipmentCandidate);
    };
  }, []);

  const handleAddToPricing = (equipment: QueuedEquipment) => {
    setSelectedEquipment(equipment);
    setShowModal(true);
  };

  const handleIgnore = async (equipment: QueuedEquipment) => {
    // Marcar TODOS os IDs do grupo no localStorage para não aparecer novamente
    equipment.allTransactionIds.forEach(id => {
      markTransactionAsProcessed(id);
    });
    
    // Persistir no Supabase para multi-dispositivo (todos os IDs)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Inserir todos os IDs de uma vez
        const inserts = equipment.allTransactionIds.map(transactionId => ({
          user_id: user.id,
          transaction_id: transactionId
        }));
        
        await supabase
          .from('pricing_ignored_transactions' as any)
          .insert(inserts);
      }
    } catch (error) {
      console.error('Erro ao persistir transações ignoradas:', error);
    }
    
    // Remover da fila visual
    setQueuedEquipments(prev => prev.filter(eq => eq.id !== equipment.id));
  };

  const handleGoToPricing = () => {
    navigate('/precificacao');
  };

  const handleModalSuccess = () => {
    if (selectedEquipment) {
      // Marcar TODOS os IDs do grupo como processados
      selectedEquipment.allTransactionIds.forEach(id => {
        markTransactionAsProcessed(id);
      });
      // Remover da fila após sucesso
      setQueuedEquipments(prev => prev.filter(eq => eq.id !== selectedEquipment.id));
      setSelectedEquipment(null);
    }
    setShowModal(false);
  };

  const handleModalClose = () => {
    setSelectedEquipment(null);
    setShowModal(false);
  };

  // Auto-remove equipments after 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setQueuedEquipments(prev => prev.filter(eq => now - eq.timestamp < 120000) // 2 minutes
      );
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);
  if (queuedEquipments.length === 0) return null;
  const currentEquipment = queuedEquipments[0];

  return (
    <>
      <AlertDialog open={!showModal && queuedEquipments.length > 0} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-full flex-shrink-0">
                <Wrench className="h-4 w-4 text-primary" />
              </div>
              Equipamento Detectado
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <p>
                Detectamos o registro do equipamento <strong className="text-foreground">{currentEquipment.nome}</strong> no valor de <strong className="text-foreground">R$ {currentEquipment.valor.toFixed(2)}</strong>.
              </p>
              <p>
                Você pode cadastrar automaticamente esse equipamento em "Meus equipamentos" para finalidade de depreciação e precificação de pacotes.
              </p>
              {queuedEquipments.length > 1 && (
                <p className="text-xs text-muted-foreground mt-4">
                  +{queuedEquipments.length - 1} outros equipamentos detectados aguardando.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
            <Button variant="ghost" onClick={() => handleIgnore(currentEquipment)}>
              Não cadastrar / Mais tarde
            </Button>
            <Button onClick={() => handleAddToPricing(currentEquipment)}>
              Configurar agora
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedEquipment && (
        <EquipmentSyncModal 
          equipment={selectedEquipment} 
          open={showModal} 
          onOpenChange={setShowModal} 
          onSuccess={handleModalSuccess} 
          onClose={handleModalClose} 
        />
      )}
    </>
  );
}