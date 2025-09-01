import { AddEquipmentFromTransactionModal } from '@/components/equipments/AddEquipmentFromTransactionModal';
import type { EquipmentModalGatewayProps } from './types';

export function EquipmentModalGateway({ 
  equipmentModalOpen, 
  equipmentData, 
  handleEquipmentModalClose 
}: EquipmentModalGatewayProps) {
  return (
    <AddEquipmentFromTransactionModal
      isOpen={equipmentModalOpen}
      onClose={handleEquipmentModalClose}
      equipmentData={equipmentData}
    />
  );
}