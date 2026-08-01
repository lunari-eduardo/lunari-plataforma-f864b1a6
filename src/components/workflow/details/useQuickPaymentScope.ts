import { useCallback, useRef, useState } from "react";

interface Params {
  sessionId: string;
  /** Pendente atual da sessão (sem sinal negativo) */
  pendente: number;
  /** Quando a sessão tem galeria, os extras são geridos pela galeria — não perguntamos escopo */
  hasGaleria: boolean;
  valorFotoExtra: number;
  qtdFotosExtraAtual: number;
  addPayment: (id: string, valor: number) => Promise<void> | void;
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
}

/**
 * Pagamento rápido com escopo do excedente.
 * Quando o valor recebido ultrapassa o pendente da sessão, exige a escolha
 * entre "sessão" (crédito) e "fotos extras" (alimenta métricas de produção).
 */
export function useQuickPaymentScope({
  sessionId,
  pendente,
  hasGaleria,
  valorFotoExtra,
  qtdFotosExtraAtual,
  addPayment,
  onFieldUpdate,
}: Params) {
  const [paymentInput, setPaymentInput] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState(0);
  const submittingRef = useRef(false);

  const excedente = Math.max(0, pendingValue - Math.max(0, pendente));

  const commitPayment = useCallback(
    async (value: number, raw: string) => {
      submittingRef.current = true;
      try {
        await addPayment(sessionId, value);
      } catch (error) {
        setPaymentInput(raw);
        console.error("❌ Erro ao adicionar pagamento:", error);
      } finally {
        submittingRef.current = false;
      }
    },
    [addPayment, sessionId],
  );

  const handlePaymentAdd = useCallback(async () => {
    if (submittingRef.current) return;
    const raw = paymentInput.trim();
    const value = parseFloat(raw.replace(",", "."));
    if (!raw || isNaN(value) || value <= 0) return;

    const excesso = value - Math.max(0, pendente);
    const precisaEscopo = !hasGaleria && excesso > 0.01 && valorFotoExtra > 0;

    if (precisaEscopo) {
      setPendingValue(value);
      setScopeOpen(true);
      return;
    }

    setPaymentInput("");
    await commitPayment(value, raw);
  }, [paymentInput, pendente, hasGaleria, valorFotoExtra, commitPayment]);

  const handlePaymentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (submittingRef.current) return;
        handlePaymentAdd();
      }
    },
    [handlePaymentAdd],
  );

  const cancelScope = useCallback(() => {
    setScopeOpen(false);
    setPendingValue(0);
  }, []);

  const chooseSessao = useCallback(async () => {
    const value = pendingValue;
    setScopeOpen(false);
    setPendingValue(0);
    setPaymentInput("");
    await commitPayment(value, String(value));
  }, [pendingValue, commitPayment]);

  const chooseExtras = useCallback(
    async (qtdFotos: number) => {
      const value = pendingValue;
      setScopeOpen(false);
      setPendingValue(0);
      setPaymentInput("");
      // Registra a venda de extras ANTES do pagamento para que o pendente
      // já reflita o novo total quando o pagamento for alocado.
      onFieldUpdate(sessionId, "qtdFotosExtra", (qtdFotosExtraAtual || 0) + qtdFotos);
      await commitPayment(value, String(value));
    },
    [pendingValue, commitPayment, onFieldUpdate, sessionId, qtdFotosExtraAtual],
  );

  return {
    paymentInput,
    setPaymentInput,
    handlePaymentAdd,
    handlePaymentKeyDown,
    scopeOpen,
    excedente,
    cancelScope,
    chooseSessao,
    chooseExtras,
  };
}
