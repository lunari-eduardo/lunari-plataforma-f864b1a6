import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Plus, X, CheckCircle, ExternalLink } from 'lucide-react';

import { 
  EQUIPMENT_SYNC_EVENT, 
  EQUIPMENT_CREATED_EVENT,
  type EquipmentCandidate 
} from '@/hooks/useEquipmentSync';
import { EquipmentSyncModal } from './EquipmentSyncModal';

interface QueuedEquipment extends EquipmentCandidate {
  id: string;
  timestamp: number;
}

interface CreatedEquipment {
  id: string;
  transacaoId: string;
  equipamentoId: string;
  nome: string;
  valor: number;
  data: string;
  vidaUtil: number;
  depreciacaoMensal: number;
  timestamp: number;
}

export function EquipmentSyncNotification() {
  const navigate = useNavigate();
  const [queuedEquipments, setQueuedEquipments] = useState<QueuedEquipment[]>([]);
  const [createdEquipments, setCreatedEquipments] = useState<CreatedEquipment[]>([]);
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

    const handleEquipmentCreated = (event: any) => {
      const created = event.detail;
      
      const createdEquipment: CreatedEquipment = {
        ...created,
        id: `created_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };

      setCreatedEquipments(prev => [createdEquipment, ...prev]);
      console.log('🔧 [EquipmentNotification] Equipamento criado com sucesso:', createdEquipment);
    };

    window.addEventListener(EQUIPMENT_SYNC_EVENT, handleEquipmentCandidate);
    window.addEventListener(EQUIPMENT_CREATED_EVENT, handleEquipmentCreated);

    return () => {
      window.removeEventListener(EQUIPMENT_SYNC_EVENT, handleEquipmentCandidate);
      window.removeEventListener(EQUIPMENT_CREATED_EVENT, handleEquipmentCreated);
    };
  }, []);

  const handleAddToPricing = (equipment: QueuedEquipment) => {
    setSelectedEquipment(equipment);
    setShowModal(true);
  };

  const handleIgnore = (equipmentId: string) => {
    setQueuedEquipments(prev => prev.filter(eq => eq.id !== equipmentId));
  };

  const handleDismissCreated = (equipmentId: string) => {
    setCreatedEquipments(prev => prev.filter(eq => eq.id !== equipmentId));
  };

  const handleGoToPricing = () => {
    navigate('/precificacao');
  };

  const handleModalSuccess = () => {
    if (selectedEquipment) {
      // Remover da fila após sucesso
      setQueuedEquipments(prev => prev.filter(eq => eq.id !== selectedEquipment.id));
      
      // Adicionar na lista de criados para mostrar toast de sucesso
      const createdEquipment: CreatedEquipment = {
        id: `created_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        transacaoId: selectedEquipment.transacaoId,
        equipamentoId: `eq_${Date.now()}`,
        nome: selectedEquipment.nome,
        valor: selectedEquipment.valor,
        data: selectedEquipment.data,
        vidaUtil: 5, // Valor padrão
        depreciacaoMensal: selectedEquipment.valor / (5 * 12),
        timestamp: Date.now()
      };
      
      setCreatedEquipments(prev => [createdEquipment, ...prev]);
      setSelectedEquipment(null);
    }
    setShowModal(false);
  };

  const handleModalClose = () => {
    setSelectedEquipment(null);
    setShowModal(false);
  };

  // Auto-remove equipments after 2-3 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setQueuedEquipments(prev => 
        prev.filter(eq => (now - eq.timestamp) < 120000) // 2 minutes
      );
      setCreatedEquipments(prev => 
        prev.filter(eq => (now - eq.timestamp) < 180000) // 3 minutes
      );
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (queuedEquipments.length === 0 && createdEquipments.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {/* Success notifications for created equipment */}
        {createdEquipments.slice(0, 2).map((equipment) => (
          <Card key={equipment.id} className="p-3 shadow-lg border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-green-100 dark:bg-green-900 rounded-full flex-shrink-0">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium truncate text-green-800 dark:text-green-200">
                    Equipamento Adicionado!
                  </h4>
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Sucesso
                  </Badge>
                </div>
                
                <p className="text-sm text-green-700 dark:text-green-300 truncate mb-1">
                  {equipment.nome}
                </p>
                
                <div className="flex items-center justify-between text-xs text-green-600 dark:text-green-400 mb-2">
                  <span>R$ {equipment.valor.toFixed(2)}</span>
                  <span>Depreciação: R$ {equipment.depreciacaoMensal.toFixed(2)}/mês</span>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleGoToPricing}
                    className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ver na Precificação
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleDismissCreated(equipment.id)}
                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {/* Pending notifications for manual processing */}
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
          <Card className="p-3 text-center text-xs text-muted-foreground bg-muted/50 border-dashed">
            <Wrench className="h-4 w-4 mx-auto mb-1 opacity-60" />
            <div>+{queuedEquipments.length - 3} equipamentos na fila</div>
            <div className="text-[10px] mt-1">Clique em "Configurar" nos itens acima</div>
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