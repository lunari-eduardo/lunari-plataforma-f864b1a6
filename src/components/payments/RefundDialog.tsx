import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RotateCcw, AlertTriangle, Wallet } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import type { SessionPaymentExtended } from '@/types/sessionPayments';

type Provider = 'asaas' | 'mercadopago' | 'infinitepay' | 'pix_manual' | 'manual';

function classifyProvider(payment: SessionPaymentExtended | null): {
  provider: Provider;
  automatable: boolean;
  label: string;
} {
  if (!payment) return { provider: 'manual', automatable: false, label: 'manual' };

  if (payment.origem === 'asaas') return { provider: 'asaas', automatable: true, label: 'Asaas' };
  if (payment.origem === 'mercadopago') return { provider: 'mercadopago', automatable: true, label: 'Mercado Pago' };
  if (payment.origem === 'infinitepay') return { provider: 'infinitepay', automatable: false, label: 'InfinitePay' };

  // PIX manual detectado por forma_pagamento ou observacoes
  const fp = (payment.forma_pagamento || '').toLowerCase();
  const obs = (payment.observacoes || '').toLowerCase();
  if (fp.includes('pix') || obs.includes('pix manual')) {
    return { provider: 'pix_manual', automatable: false, label: 'PIX manual' };
  }

  return { provider: 'manual', automatable: false, label: 'manual' };
}

interface RefundDialogProps {
  payment: SessionPaymentExtended | null;
  onClose: () => void;
  onConfirm: (motivo: string, autoRefund: boolean) => void | Promise<void>;
}

export function RefundDialog({ payment, onClose, onConfirm }: RefundDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [autoRefund, setAutoRefund] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { automatable, label } = classifyProvider(payment);

  // Resetar estado ao abrir novo pagamento
  useEffect(() => {
    if (payment) {
      setMotivo('');
      setAutoRefund(automatable); // default: true se automatizável
      setSubmitting(false);
    }
  }, [payment?.id, automatable]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(motivo, automatable && autoRefund);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={!!payment} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {automatable ? (
              <RotateCcw className="h-5 w-5 text-orange-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            )}
            Estornar pagamento?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {automatable ? (
                <p className="text-sm">
                  Este pagamento foi processado via <strong>{label}</strong>.
                  O estorno pode ser realizado diretamente na sua conta de pagamento
                  e o valor será devolvido ao cliente.
                </p>
              ) : (
                <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-foreground">
                  O estorno deste pagamento ({label === 'manual' ? 'lançamento manual' : label}) deve ser
                  realizado <strong>manualmente fora do sistema</strong>.
                  Esta ação servirá apenas para <strong>controle financeiro interno</strong> —
                  o dinheiro não será devolvido automaticamente ao cliente.
                </div>
              )}

              <p className="text-sm">
                Valor: <strong>{payment ? formatCurrency(payment.valor) : ''}</strong>.
                O pagamento original será mantido para auditoria.
              </p>

              <div>
                <label className="text-sm font-medium text-foreground">Motivo (opcional)</label>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex: Cliente desistiu, erro de cobrança..."
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
                />
              </div>

              {automatable && (
                <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                  <Checkbox
                    checked={autoRefund}
                    onCheckedChange={(v) => setAutoRefund(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-foreground">
                    Realizar estorno automaticamente no {label}
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {autoRefund
                        ? 'O valor será devolvido ao cliente via API do gateway.'
                        : 'Apenas o controle interno será registrado; o estorno real deverá ser feito manualmente no painel do gateway.'}
                    </span>
                  </span>
                </label>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-orange-600 text-primary-foreground hover:bg-orange-700"
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={submitting}
          >
            {submitting
              ? 'Processando...'
              : automatable && autoRefund
                ? 'Confirmar estorno'
                : 'Registrar estorno interno'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
