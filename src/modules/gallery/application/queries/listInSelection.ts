import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `gallery.listInSelection`
 * Lista galerias atualmente em seleção com progresso e dias restantes.
 */
const Input = z.object({ limit: z.number().int().min(1).max(200).default(50) }).strict();

const Item = z.object({
  galleryId: z.string(),
  sessionId: z.string().nullable(),
  clienteId: z.string().nullable(),
  clienteNome: z.string().nullable(),
  totalFotos: z.number(),
  fotosIncluidas: z.number(),
  fotosSelecionadas: z.number(),
  expiresAt: z.string().nullable(),
  diasRestantes: z.number().nullable(),
  status: z.string().nullable(),
});

const Output = z.object({ total: z.number(), items: z.array(Item) });

export const listInSelection = defineQuery({
  id: "gallery.listInSelection",
  title: "Galerias em seleção",
  description: "Galerias ativas com seleção em andamento.",
  input: Input,
  output: Output,
  permissions: ["gallery:read"],
  async handler({ limit }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const { data, error } = await supabase
      .from("galerias")
      .select(
        "id, session_id, cliente_id, cliente_nome, total_fotos, fotos_incluidas, fotos_selecionadas, expires_at, status, status_selecao",
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("status_selecao", ["em_selecao", "aguardando"])
      .order("expires_at", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      ctx.log.error("listInSelection falhou", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível listar galerias.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const now = Date.now();
    const items = (data ?? []).map((g: any) => {
      const exp = g.expires_at ? new Date(g.expires_at).getTime() : null;
      const dias = exp ? Math.ceil((exp - now) / (1000 * 60 * 60 * 24)) : null;
      return {
        galleryId: g.id,
        sessionId: g.session_id ?? null,
        clienteId: g.cliente_id ?? null,
        clienteNome: g.cliente_nome ?? null,
        totalFotos: Number(g.total_fotos ?? 0),
        fotosIncluidas: Number(g.fotos_incluidas ?? 0),
        fotosSelecionadas: Number(g.fotos_selecionadas ?? 0),
        expiresAt: g.expires_at ?? null,
        diasRestantes: dias,
        status: g.status_selecao ?? g.status ?? null,
      };
    });

    return ok({ total: items.length, items });
  },
});
