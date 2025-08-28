import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Plus, X } from 'lucide-react';

import { EQUIPMENT_SYNC_EVENT, type EquipmentCandidate } from '@/hooks/useEquipmentSync';
import { EquipmentSyncModal } from './EquipmentSyncModal';

interface QueuedEquipment extends EquipmentCandidate {
  id: string;
  timestamp: number;
}

export function EquipmentSyncNotification() {
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

  const handleIgnore = (equipmentId: string) => {
    setQueuedEquipments(prev => prev.filter(eq => eq.id !== equipmentId));
  };

  const handleModalSuccess = () => {
    if (selectedEquipment) {
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
      setQueuedEquipments(prev => 
        prev.filter(eq => (now - eq.timestamp) < 120000) // 2 minutes
      );
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (queuedEquipments.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {queuedEquipments.slice(0, 3).map((equipment) => (
          <Card key={equipment.id} className="p-3 shadow-lg border-border bg-card">
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
                  <span>{new Date(equipment.data).toLocaleDateString('pt-BR')}</span>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleAddToPricing(equipment)}
                    className="h-7 text-xs flex-1"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar à Precificação
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleIgnore(equipment.id)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        
        {queuedEquipments.length > 3 && (
          <Card className="p-2 text-center text-xs text-muted-foreground bg-card">
            +{queuedEquipments.length - 3} equipamentos na fila
          </Card>
        )}
      </div>

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