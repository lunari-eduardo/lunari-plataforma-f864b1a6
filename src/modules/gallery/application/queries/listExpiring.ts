import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `gallery.listExpiring`
 * Galerias já expiradas ou expirando dentro de N dias.
 */
const Input = z
  .object({
    dias: z.number().int().min(0).max(60).default(7),
    incluirExpiradas: z.boolean().default(true),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .strict();

const Item = z.object({
  galleryId: z.string(),
  sessionId: z.string().nullable(),
  clienteId: z.string().nullable(),
  clienteNome: z.string().nullable(),
  expiresAt: z.string().nullable(),
  diasRestantes: z.number(),
  status: z.string().nullable(),
  jaExpirou: z.boolean(),
});

const Output = z.object({ total: z.number(), items: z.array(Item) });

export const listExpiring = defineQuery({
  id: "gallery.listExpiring",
  title: "Galerias expirando",
  description: "Galerias ativas expiradas ou a expirar dentro de N dias.",
  input: Input,
  output: Output,
  permissions: ["gallery:read"],
  async handler({ dias, incluirExpiradas, limit }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const limite = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("galerias")
      .select(
        "id, session_id, cliente_id, cliente_nome, expires_at, status, status_selecao",
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("expires_at", "is", null)
      .in("status_selecao", ["em_selecao", "aguardando", "expirada"])
      .lte("expires_at", limite)
      .order("expires_at", { ascending: true })
      .limit(limit);

    if (error) {
      ctx.log.error("listExpiring falhou", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível listar galerias.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const now = Date.now();
    const items = (data ?? [])
      .map((g: any) => {
        const exp = g.expires_at ? new Date(g.expires_at).getTime() : now;
        const dR = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
        return {
          galleryId: g.id,
          sessionId: g.session_id ?? null,
          clienteId: g.cliente_id ?? null,
          clienteNome: g.cliente_nome ?? null,
          expiresAt: g.expires_at ?? null,
          diasRestantes: dR,
          status: g.status_selecao ?? g.status ?? null,
          jaExpirou: dR < 0,
        };
      })
      .filter((i) => incluirExpiradas || !i.jaExpirou);

    return ok({ total: items.length, items });
  },
});
