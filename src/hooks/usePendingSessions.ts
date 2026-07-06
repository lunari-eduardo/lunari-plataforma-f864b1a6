import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PendingSession {
  session_id: string;
  data_sessao: string | null;
  pacote: string | null;
  pendente: number;
}

/**
 * Lista sessões do cliente com valor pendente > 0, ordenadas por data
 * crescente. Usado por painéis de crédito para permitir aplicar o saldo
 * do cliente numa sessão em aberto.
 */
export function usePendingSessions(clienteId?: string | null, enabled = true) {
  return useQuery<PendingSession[]>({
    queryKey: ["cliente-sessoes-pendentes", clienteId ?? "none"],
    enabled: enabled && Boolean(clienteId),
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes_sessoes")
        .select("session_id, data_sessao, pacote, valor_total, valor_pago")
        .eq("cliente_id", clienteId as string)
        .order("data_sessao", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .map((r) => ({
          session_id: r.session_id,
          data_sessao: r.data_sessao,
          pacote: r.pacote,
          pendente: Math.max(
            Number(r.valor_total ?? 0) - Number(r.valor_pago ?? 0),
            0,
          ),
        }))
        .filter((r) => r.pendente > 0);
    },
  });
}
