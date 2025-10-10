import { SessionPaymentsManager } from '@/components/payments/SessionPaymentsManager';
import { SessionData } from '@/types/workflow';

interface WorkflowPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: SessionData;
  valorTotalCalculado?: number;
  onPaymentUpdate: (sessionId: string, totalPaid: number, fullPaymentsArray?: any[]) => void;
}

export function WorkflowPaymentsModal({
  isOpen,
  onClose,
  sessionData,
  valorTotalCalculado,
  onPaymentUpdate
}: WorkflowPaymentsModalProps) {
  return (
    <SessionPaymentsManager
      displayMode="modal"
      isOpen={isOpen}
      onClose={onClose}
      sessionData={sessionData}
      onPaymentUpdate={onPaymentUpdate}
    />
  );
}
