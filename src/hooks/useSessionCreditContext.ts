import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Estado de crédito da PERSPECTIVA de uma sessão específica:
 *  - `generatedBySession`: total de crédito que ESTA sessão gerou (overpay/redução de escopo).
 *  - `consumedFromSession`: total do crédito gerado por ESTA sessão que já foi consumido em outras.
 *  - `remainingFromSession`: saldo remanescente do crédito gerado por ESTA sessão (>=0).
 *  - `sessionConsumedIn`: session_id em que o crédito foi (ou está sendo) consumido, quando aplicável.
 */
export interface SessionCreditContext {
  generatedBySession: number;
  consumedFromSession: number;
  remainingFromSession: number;
  sessionConsumedIn: string | null;
}

const EMPTY: SessionCreditContext = {
  generatedBySession: 0,
  consumedFromSession: 0,
  remainingFromSession: 0,
  sessionConsumedIn: null,
};

async function fetchContext(sessionId: string): Promise<SessionCreditContext> {
  const { data, error } = await supabase
    .from("cliente_creditos_ledger")
    .select("valor, origem, session_id_consumo")
    .eq("session_id_origem", sessionId);

  if (error) {
    console.error("[useSessionCreditContext] fetch error", error);
    return EMPTY;
  }

  let generated = 0;
  let consumed = 0;
  let consumedIn: string | null = null;

  for (const row of data ?? []) {
    const v = Number(row.valor);
    if (row.origem === "consumo_desconto") {
      // valor é negativo
      consumed += -v;
      if (!consumedIn && row.session_id_consumo) {
        consumedIn = row.session_id_consumo;
      }
    } else if (v > 0) {
      generated += v;
    } else {
      // reversao_grant / ajustes negativos reduzem o gerado
      generated += v;
    }
  }

  const remaining = Math.max(0, generated - consumed);
  return {
    generatedBySession: generated,
    consumedFromSession: consumed,
    remainingFromSession: remaining,
    sessionConsumedIn: consumedIn,
  };
}

/**
 * Hook para exibir o estado do crédito na perspectiva de uma sessão.
 * Retorna contexto vazio quando `sessionId` não é fornecido.
 */
export function useSessionCreditContext(sessionId?: string | null) {
  const qc = useQueryClient();
  const enabled = Boolean(sessionId);

  const query = useQuery<SessionCreditContext>({
    queryKey: ["session-credit-context", sessionId ?? "none"],
    enabled,
    staleTime: 15_000,
    queryFn: () => fetchContext(sessionId as string),
  });

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`session-credit-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cliente_creditos_ledger",
          filter: `session_id_origem=eq.${sessionId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["session-credit-context", sessionId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, qc]);

  return query;
}
