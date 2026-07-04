import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRunCapability, CapabilityError } from "@/shared/capability/react";
import {
  getClientCredit,
  applyClientCredit,
  grantClientCredit,
  revokeClientCredit,
} from "@/modules/finance";

export interface ClienteCreditoLedgerRow {
  id: string;
  data: string;
  valor: number;
  origem: string;
  session_id_origem: string | null;
  session_id_consumo: string | null;
  descricao: string | null;
  expira_em: string | null;
  created_at: string;
}

export interface ClienteCreditoState {
  saldo: number;
  proximaExpiracao: string | null;
  historico: ClienteCreditoLedgerRow[];
}

/**
 * Consulta saldo + histórico de crédito do cliente com invalidação por
 * realtime em `cliente_creditos_ledger`.
 */
export function useClienteCredito(clienteId?: string | null, incluirHistorico = true) {
  const qc = useQueryClient();
  const run = useRunCapability();
  const enabled = Boolean(clienteId);

  const query = useQuery<ClienteCreditoState, CapabilityError>({
    queryKey: ["cliente-credito", clienteId ?? "none", incluirHistorico],
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      if (!clienteId) return { saldo: 0, proximaExpiracao: null, historico: [] };
      const res = await run(getClientCredit, {
        clienteId,
        incluirHistorico,
        historicoLimit: 100,
      });
      if (!res.ok) throw new CapabilityError(res.error);
      return res.value as ClienteCreditoState;
    },
  });

  useEffect(() => {
    if (!clienteId) return;
    const channel = supabase
      .channel(`credit-${clienteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cliente_creditos_ledger",
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["cliente-credito", clienteId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteId, qc]);

  return query;
}

interface ApplyInput {
  clienteId: string;
  sessionId: string;
  valor: number;
}

export function useApplyClientCredit() {
  const qc = useQueryClient();
  const run = useRunCapability();
  return useMutation({
    mutationFn: async (input: ApplyInput) => {
      const res = await run(applyClientCredit, input);
      if (!res.ok) throw new CapabilityError(res.error);
      return res.value;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["cliente-credito", vars.clienteId] });
      qc.invalidateQueries({ queryKey: ["workflow"] });
      qc.invalidateQueries({ queryKey: ["session-payments"] });
      qc.invalidateQueries({ queryKey: ["extrato"] });
    },
  });
}

interface GrantInput {
  clienteId: string;
  valor: number;
  origem?: "ajuste_manual" | "estorno_para_credito" | "reconcile_sobra";
  descricao?: string;
  expiraEm?: string;
  sessionOrigem?: string;
}

export function useGrantClientCredit() {
  const qc = useQueryClient();
  const run = useRunCapability();
  return useMutation({
    mutationFn: async (input: GrantInput) => {
      const res = await run(grantClientCredit, {
        ...input,
        origem: input.origem ?? "ajuste_manual",
      });
      if (!res.ok) throw new CapabilityError(res.error);
      return res.value;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["cliente-credito", vars.clienteId] });
    },
  });
}

interface RevokeInput {
  ledgerId: string;
  clienteId: string;
  motivo?: string;
}

export function useRevokeClientCredit() {
  const qc = useQueryClient();
  const run = useRunCapability();
  return useMutation({
    mutationFn: async ({ ledgerId, motivo }: RevokeInput) => {
      const res = await run(revokeClientCredit, { ledgerId, motivo });
      if (!res.ok) throw new CapabilityError(res.error);
      return res.value;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["cliente-credito", vars.clienteId] });
    },
  });
}
