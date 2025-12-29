import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Plus, X } from 'lucide-react';
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
    // Marcar no localStorage para não aparecer novamente nesta sessão
    markTransactionAsProcessed(equipment.transacaoId);
    
    // Persistir no Supabase para multi-dispositivo
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('pricing_ignored_transactions')
          .insert({
            user_id: user.id,
            transaction_id: equipment.transacaoId
          });
      }
    } catch (error) {
      console.error('Erro ao persistir transação ignorada:', error);
    }
    
    // Remover da fila visual
    setQueuedEquipments(prev => prev.filter(eq => eq.id !== equipment.id));
  };

  const handleGoToPricing = () => {
    navigate('/precificacao');
  };

  const handleModalSuccess = () => {
    if (selectedEquipment) {
      // Marcar como processada para não aparecer novamente
      markTransactionAsProcessed(selectedEquipment.transacaoId);
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
  return <>
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {/* Pending notifications for manual processing */}
        {queuedEquipments.slice(0, 3).map(equipment => <Card key={equipment.id} className="p-3 shadow-lg border-border bg-card">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-primary/10 rounded-full flex-shrink-0">
                <Wrench className="h-4 w-4 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium truncate">Equipamento Detectado</h4>
                  <Badge variant="secondary" className="text-xs">
                    Novo
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground truncate mb-1">
                  {equipment.nome}
                </p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>R$ {equipment.valor.toFixed(2)}</span>
                  
                </div>
                
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAddToPricing(equipment)} className="h-7 text-xs flex-1">
                    <Plus className="h-3 w-3 mr-1" />
                    Configurar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleIgnore(equipment.id)} className="h-7 w-7 p-0">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>)}
        
        {queuedEquipments.length > 3 && <Card className="p-3 text-center text-xs text-muted-foreground bg-muted/50 border-dashed">
            <Wrench className="h-4 w-4 mx-auto mb-1 opacity-60" />
            <div>+{queuedEquipments.length - 3} equipamentos na fila</div>
            <div className="text-[10px] mt-1">Clique em "Configurar" nos itens acima</div>
          </Card>}
      </div>

      {selectedEquipment && <EquipmentSyncModal equipment={selectedEquipment} open={showModal} onOpenChange={setShowModal} onSuccess={handleModalSuccess} onClose={handleModalClose} />}
    </>;
}