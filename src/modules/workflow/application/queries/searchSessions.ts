import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.search`
 *
 * Busca textual de sessões — combina filtros opcionais e busca por
 * cliente.nome / pacote / categoria. Pensada para a IA descobrir cards
 * por descrição natural ("sessões do João em julho", "pendentes ensaio").
 */

const Input = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  status: z.string().optional(),
  categoria: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

const Hit = z.object({
  id: z.string(),
  sessionId: z.string().nullable(),
  clienteNome: z.string().nullable(),
  dataSessao: z.string(),
  status: z.string().nullable(),
  pacote: z.string().nullable(),
  categoria: z.string().nullable(),
  valorTotal: z.number(),
  valorPago: z.number(),
});

const Output = z.object({
  total: z.number(),
  hits: z.array(Hit),
});

function monthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const end = new Date(year, month, 0).toISOString().split("T")[0];
  return { start, end };
}

export const searchSessions = defineQuery({
  id: "workflow.search",
  title: "Buscar sessões",
  description: "Busca textual + filtros sobre sessões do Workflow.",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ q, year, month, status, categoria, limit }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    let query = supabase
      .from("clientes_sessoes")
      .select(
        "id, session_id, data_sessao, status, pacote, categoria, valor_total, valor_pago, clientes(nome)",
      )
      .eq("user_id", userId)
      .or("status.is.null,status.neq.historico")
      .order("data_sessao", { ascending: false })
      .limit(limit);

    if (year && month) {
      const { start, end } = monthBounds(year, month);
      query = query.gte("data_sessao", start).lte("data_sessao", end);
    }
    if (status) query = query.eq("status", status);
    if (categoria) query = query.eq("categoria", categoria);
    if (q) {
      const like = `%${q}%`;
      // OR textual sobre campos próprios; cliente.nome filtrado em memória.
      query = query.or(`pacote.ilike.${like},categoria.ilike.${like}`);
    }

    const { data, error } = await query;
    if (error) {
      ctx.log.error("falha em workflow.search", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível pesquisar sessões.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const needle = q ? norm(q) : null;

    const hits = (data || [])
      .filter((row: any) => {
        if (!needle) return true;
        const fields = [row.pacote, row.categoria, row.clientes?.nome]
          .filter(Boolean)
          .map((v: string) => norm(v));
        return fields.some((f) => f.includes(needle));
      })
      .map((row: any) => ({
        id: row.id,
        sessionId: row.session_id ?? null,
        clienteNome: row.clientes?.nome ?? null,
        dataSessao: row.data_sessao,
        status: row.status ?? null,
        pacote: row.pacote ?? null,
        categoria: row.categoria ?? null,
        valorTotal: Number(row.valor_total ?? 0),
        valorPago: Number(row.valor_pago ?? 0),
      }));

    return ok({ total: hits.length, hits });
  },
});
