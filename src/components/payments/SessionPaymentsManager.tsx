import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { useSessionPayments } from '@/hooks/useSessionPayments';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { EditPaymentModal } from '@/components/crm/EditPaymentModal';
import { ChargeModal } from '@/components/cobranca/ChargeModal';
import { CombinedChargeModal } from '@/components/cobranca/CombinedChargeModal';
import { RefundDialog } from '@/components/payments/RefundDialog';
import { AsaasAnticipationModal } from '@/components/payments/AsaasAnticipationModal';
import { useSessionFinancialsWithExtras } from '@/features/workflow/hooks/useSessionFinancialsWithExtras';
import { supabase } from '@/integrations/supabase/client';

import { SessionPaymentsManagerProps, convertExistingPayments } from './session-manager/types';
import { SessionPaymentsSummaryCards } from './session-manager/SessionPaymentsSummaryCards';
import { SessionPaymentsActionsBar } from './session-manager/SessionPaymentsActionsBar';
import { SessionPaymentsTable } from './session-manager/SessionPaymentsTable';

export function SessionPaymentsManager({
  sessionData,
  displayMode = 'card',
  isOpen,
  onClose,
}: SessionPaymentsManagerProps) {
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeModalTab, setChargeModalTab] = useState<'cobrar' | 'historico'>('cobrar');
  const [showExtraChargeModal, setShowExtraChargeModal] = useState(false);
  const [showCombinedChargeModal, setShowCombinedChargeModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SessionPaymentExtended | null>(null);
  const [paymentToRefund, setPaymentToRefund] = useState<SessionPaymentExtended | null>(null);
  const [paymentToAnticipate, setPaymentToAnticipate] = useState<SessionPaymentExtended | null>(null);
  const [, setRefundMotivo] = useState('');

  const {
    payments,
    totalPago,
    totalRecebido,
    totalTaxas,
    totalAgendado,
    isLoading,
    editPayment,
    deletePayment,
    refundPayment,
    markAsPaid,
  } = useSessionPayments(sessionData.id, convertExistingPayments(sessionData.pagamentos || []));

  const fin = useSessionFinancialsWithExtras(
    sessionData.id,
    sessionData.galeriaId,
    sessionData.sessionId,
  );

  // Reconciliação de fallback
  useEffect(() => {
    const isVisible = displayMode === 'card' || isOpen === true;
    if (!isVisible) return;
    const sid = sessionData?.sessionId || sessionData?.id;
    if (!sid) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('cobrancas')
          .select('id, status')
          .eq('session_id', sid)
          .in('status', ['pendente', 'parcialmente_pago']);
        if (error || !data || cancelled) return;
        for (const c of data) {
          if (cancelled) return;
          try {
            await supabase.functions.invoke('check-payment-status', {
              body: { cobrancaId: c.id, forceUpdate: false },
            });
          } catch (e) {
            console.warn('[SessionPaymentsManager] reconcile falhou para', c.id, e);
          }
        }
      } catch (e) {
        console.warn('[SessionPaymentsManager] reconcile geral falhou', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [displayMode, isOpen, sessionData?.id, sessionData?.sessionId]);

  const valorTotalFallback =
    typeof sessionData.total === 'number'
      ? sessionData.total
      : parseFloat(String(sessionData.total ?? '').replace('R$', '').replace(/\./g, '').replace(',', '.').trim() || '0');

  const valorTotal = fin.totalVisual > 0 ? fin.totalVisual : valorTotalFallback;
  const valorRestante = fin.totalVisual > 0 ? fin.pendenteTot : Math.max(0, valorTotalFallback - totalPago);
  const valorRestanteSessao = fin.totalVisual > 0 ? fin.pendenteSess : valorRestante;

  const showExtrasChip = fin.hasGaleria && fin.extrasIdeal > 0;
  const isCard = displayMode === 'card';
  const showTotalChip = !isCard;
  const showCobradoChip = !isCard || Math.abs(totalPago - totalRecebido) > 0.001;
  const GRID_BY_COUNT: Record<number, string> = {
    3: 'grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-2 lg:grid-cols-6',
    7: 'grid-cols-2 lg:grid-cols-7',
  };
  const chipCount =
    (showTotalChip ? 1 : 0) + (showExtrasChip ? 2 : 0) + (showCobradoChip ? 1 : 0) + 3;
  const gridCols = GRID_BY_COUNT[chipCount] ?? 'grid-cols-2 lg:grid-cols-5';

  const canCobrarSessao = valorRestanteSessao > 0.001;
  const canCobrarExtras = fin.extrasPend > 0.001;
  const canCobrarTudo = canCobrarSessao && canCobrarExtras;

  const handleOpenChargeModal = (tab: 'cobrar' | 'historico' = 'cobrar') => {
    setChargeModalTab(tab);
    setShowChargeModal(true);
  };

  // Shared content
  const content = (
    <>
      <SessionPaymentsSummaryCards
        isCard={isCard}
        gridCols={gridCols}
        showTotalChip={showTotalChip}
        showExtrasChip={showExtrasChip}
        showCobradoChip={showCobradoChip}
        valorTotal={valorTotal}
        fin={fin}
        totalPago={totalPago}
        totalRecebido={totalRecebido}
        totalTaxas={totalTaxas}
        totalAgendado={totalAgendado}
        valorRestante={valorRestante}
      />

      <Card className={isCard ? 'border-0 bg-transparent shadow-none' : undefined}>
        <SessionPaymentsActionsBar
          isCard={isCard}
          hasGaleria={fin.hasGaleria}
          canCobrarSessao={canCobrarSessao}
          canCobrarExtras={canCobrarExtras}
          canCobrarTudo={canCobrarTudo}
          valorRestanteSessao={valorRestanteSessao}
          extrasPend={fin.extrasPend}
          onOpenChargeModal={handleOpenChargeModal}
          onOpenExtraChargeModal={() => setShowExtraChargeModal(true)}
          onCobrarTudo={() => setShowCombinedChargeModal(true)}
        />
        <SessionPaymentsTable
          payments={payments}
          isLoading={isLoading}
          isCard={isCard}
          onMarkAsPaid={markAsPaid}
          onEditPayment={setEditingPayment}
          onDeletePayment={deletePayment}
          onRefundPayment={setPaymentToRefund}
          onAnticipatePayment={setPaymentToAnticipate}
        />
      </Card>

      {/* Modais */}
      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          onClose={() => setEditingPayment(null)}
          onSave={updates => {
            editPayment(editingPayment.id, updates);
            setEditingPayment(null);
          }}
        />
      )}

      {/* Refund Confirmation Dialog */}
      <RefundDialog
        payment={paymentToRefund}
        onClose={() => { setPaymentToRefund(null); setRefundMotivo(''); }}
        onConfirm={async (motivo, autoRefund, keepAsCredit) => {
          if (paymentToRefund) {
            const ok = await refundPayment(paymentToRefund.id, { motivo: motivo || undefined, autoRefund, keepAsCredit });
            if (ok) { setPaymentToRefund(null); setRefundMotivo(''); }
          }
        }}
      />

      {/* Charge Modal (sessão isolada ou histórico) */}
      <ChargeModal
        isOpen={showChargeModal}
        onClose={() => setShowChargeModal(false)}
        clienteId={sessionData.clienteId || ''}
        clienteNome={sessionData.nome || 'Cliente'}
        clienteWhatsapp={sessionData.whatsapp}
        sessionId={sessionData.sessionId || sessionData.id}
        valorSugerido={valorRestanteSessao}
        initialTab={chargeModalTab}
      />

      {/* Extra Charge Modal (fotos extras) */}
      <ChargeModal
        isOpen={showExtraChargeModal}
        onClose={() => setShowExtraChargeModal(false)}
        clienteId={sessionData.clienteId || ''}
        clienteNome={sessionData.nome || 'Cliente'}
        clienteWhatsapp={sessionData.whatsapp}
        sessionId={sessionData.sessionId || sessionData.id}
        galeriaId={fin.resolvedGalleryId || null}
        valorSugerido={fin.extrasPend}
        finalidade="fotos_extras"
        qtdFotos={fin.qtdExtras || 0}
        nomeSessao={sessionData.descricao || sessionData.categoria}
      />

      {/* Combined Charge Modal — link único cobrindo sessão + extras */}
      {fin.resolvedGalleryId && showCombinedChargeModal && (
        <CombinedChargeModal
          isOpen={showCombinedChargeModal}
          onClose={() => setShowCombinedChargeModal(false)}
          clienteId={sessionData.clienteId || ''}
          clienteNome={sessionData.nome || 'Cliente'}
          clienteWhatsapp={sessionData.whatsapp}
          sessionId={sessionData.sessionId || sessionData.id}
          galeriaId={fin.resolvedGalleryId}
          valorSessaoComponente={valorRestanteSessao}
          valorExtrasComponente={fin.extrasPend}
          qtdFotosExtras={fin.qtdExtras || 0}
          nomeSessao={sessionData.descricao || sessionData.categoria}
        />
      )}

      {/* Asaas Anticipation Modal */}
      <AsaasAnticipationModal
        isOpen={Boolean(paymentToAnticipate)}
        onClose={() => setPaymentToAnticipate(null)}
        payment={paymentToAnticipate}
      />
    </>
  );

  if (displayMode === 'modal') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg md:text-xl">Gerenciamento de Pagamentos</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {content}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return <div className="space-y-6">{content}</div>;
}
