import { SessionPaymentsManager } from '@/components/payments/SessionPaymentsManager';
interface SessionPaymentHistoryProps {
  sessionData: any;
  onPaymentUpdate: (sessionId: string, totalPaid: number, fullPaymentsArray?: any[]) => void;
}
export function SessionPaymentHistory({
  sessionData,
  onPaymentUpdate
}: SessionPaymentHistoryProps) {
  return (
    <SessionPaymentsManager
      displayMode="card"
      sessionData={sessionData}
      onPaymentUpdate={onPaymentUpdate}
    />
  );
}