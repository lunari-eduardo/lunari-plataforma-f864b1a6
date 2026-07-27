import { supabase } from "@/integrations/supabase/client";
import type { IntelligenceUpsert } from "@/shared/intelligence";

/**
 * Analyzer `client.at_risk`.
 *
 * Cliente com sessão futura marcada E sem interação há > 60 dias
 * (última sessão/atualização) → sinal de risco.
 * Heurística proxy usando `updated_at` do cliente + próxima sessão.
 */
export async function analyzeClientAtRisk(userId: string): Promise<IntelligenceUpsert[]> {
  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions, error: sErr } = await supabase
    .from("clientes_sessoes")
    .select("cliente_id, data")
    .eq("user_id", userId)
    .gte("data", nowIso)
    .not("cliente_id", "is", null)
    .limit(500);
  if (sErr) return [];

  const clienteIds = Array.from(
    new Set((sessions ?? []).map((s) => String(s.cliente_id)).filter(Boolean)),
  );
  if (clienteIds.length === 0) return [];

  const { data: clientes, error: cErr } = await supabase
    .from("clientes")
    .select("id, nome, updated_at")
    .in("id", clienteIds);
  if (cErr) return [];

  return (clientes ?? [])
    .filter((c) => (c.updated_at ?? "") < cutoffIso)
    .map((c) => ({
      userId,
      kind: "client.at_risk" as const,
      scopeKey: String(c.id),
      severity: "warn" as const,
      score: 0.6,
      reasons: [
        `Cliente ${c.nome ?? "sem nome"} sem interação há mais de 60 dias.`,
        "Sessão futura agendada.",
      ],
      inputsHash: `car:${c.id}:${c.updated_at}`,
    }));
}
