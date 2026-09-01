import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, AlertCircle, Calendar, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SessionPaymentExtended } from '@/types/sessionPayments';

interface AsaasAnticipationModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: SessionPaymentExtended | null;
  onSuccess?: () => void;
}

interface SimulationData {
  anticipableValue: number;
  fee: number;
  netValue: number;
  estimatedCreditDate: string;
  totalValue: number;
}

export function AsaasAnticipationModal({
  isOpen,
  onClose,
  payment,
  onSuccess,
}: AsaasAnticipationModalProps) {
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [simulation, setSimulation] = useState<SimulationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !payment) {
      setSimulation(null);
      setError(null);
      return;
    }

    let isMounted = true;
    async function fetchSimulation() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: funcError } = await supabase.functions.invoke('gestao-asaas-anticipation', {
          body: {
            action: 'simulate',
            cobrancaId: payment?.cobrancaId || undefined,
            parcelaId: payment?.parcelaId || undefined,
          },
        });

        if (funcError) {
          throw new Error(funcError.message || 'Erro ao simular antecipação');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Não foi possível simular a antecipação para este recebível');
        }

        if (isMounted) {
          setSimulation(data.simulation);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Erro ao simular antecipação');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchSimulation();

    return () => {
      isMounted = false;
    };
  }, [isOpen, payment]);

  const handleRequestAnticipation = async () => {
    if (!payment) return;
    setRequesting(true);
    try {
      const { data, error: funcError } = await supabase.functions.invoke('gestao-asaas-anticipation', {
        body: {
          action: 'request',
          cobrancaId: payment.cobrancaId || undefined,
          parcelaId: payment.parcelaId || undefined,
        },
      });

      if (funcError) {
        throw new Error(funcError.message || 'Erro ao solicitar antecipação');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Não foi possível solicitar a antecipação');
      }

      toast.success('Solicitação de antecipação enviada com sucesso ao Asaas!');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao solicitar antecipação');
    } finally {
      setRequesting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Hoje';
    const [y, m, d] = dateStr.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Zap className="h-5 w-5 text-accent-gold" />
            <DialogTitle>Antecipação de Recebível (Asaas)</DialogTitle>
          </div>
          <DialogDescription>
            Simule e solicite a antecipação imediata desta parcela junto ao Asaas.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Consultando taxas de antecipação no Asaas...</p>
          </div>
        ) : error ? (
          <div className="py-4">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        ) : simulation ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/40 border border-border/30 p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor Bruto da Parcela:</span>
                <span className="font-medium">{formatCurrency(simulation.totalValue || payment?.valor || 0)}</span>
              </div>
              <div className="flex justify-between text-sm text-destructive">
                <span>Taxa de Antecipação Asaas:</span>
                <span>- {formatCurrency(simulation.fee)}</span>
              </div>
              <div className="pt-2 border-t border-border/20 flex justify-between text-base font-semibold text-emerald-600 dark:text-emerald-500">
                <span>Valor Líquido a Receber:</span>
                <span>{formatCurrency(simulation.netValue)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-md border border-border/10">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span>
                Previsão de crédito: <strong>{formatDate(simulation.estimatedCreditDate)}</strong> (sujeito à aprovação de risco do Asaas).
              </span>
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={requesting}>
            Cancelar
          </Button>
          <Button
            onClick={handleRequestAnticipation}
            disabled={loading || !simulation || requesting}
            className="gap-1.5"
          >
            {requesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Solicitando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Antecipação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
