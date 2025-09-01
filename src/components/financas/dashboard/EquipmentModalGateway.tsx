import { AddEquipmentFromTransactionModal } from '@/components/equipments/AddEquipmentFromTransactionModal';
import type { EquipmentModalGatewayProps } from './types';

export function EquipmentModalGateway({ 
  equipmentModalOpen, 
  equipmentData, 
  handleEquipmentModalClose 
}: EquipmentModalGatewayProps) {
  // Only render the modal if equipmentData is not null
  if (!equipmentModalOpen || !equipmentData) {
    return null;
  }

  return (
    <AddEquipmentFromTransactionModal
      isOpen={equipmentModalOpen}
      onClose={handleEquipmentModalClose}
      equipmentData={equipmentData}
    />
  );
}