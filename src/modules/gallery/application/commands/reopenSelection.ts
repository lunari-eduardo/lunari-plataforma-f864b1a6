import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `gallery.reopenSelection`
 *
 * Reativa a seleção de uma galeria por N dias. Delega à RPC
 * `reopen_gallery_selection(p_gallery_id, p_days)` que ajusta status +
 * `expires_at` e dispara triggers do Gallery.
 *
 * Requer aprovação humana (o Lu deve perguntar quantos dias).
 */
const Input = z
  .object({
    galeriaId: z.string().uuid(),
    dias: z.number().int().min(1).max(90),
    motivo: z.string().max(240).optional(),
  })
  .strict();

const Output = z.object({
  galeriaId: z.string(),
  novoExpiresAt: z.string().nullable(),
});

export const reopenSelection = defineCommand({
  id: "gallery.reopenSelection",
  title: "Reativar seleção da galeria",
  description:
    "Reabre a seleção de uma galeria por N dias (mínimo 1, máximo 90). O Lu deve confirmar dias com o usuário.",
  input: Input,
  output: Output,
  permissions: ["gallery:write"],
  sideEffects: ["db:galerias", "event:gallery.reopened"],
  audit: "always",
  needsApproval: true,
  async handler({ galeriaId, dias, motivo }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const { data: g, error: gErr } = await supabase
      .from("galerias")
      .select("id, user_id")
      .eq("id", galeriaId)
      .maybeSingle();
    if (gErr || !g) {
      return err(domainError("NOT_FOUND", "Galeria não encontrada.", { cause: gErr }));
    }
    if (g.user_id !== userId) {
      return err(domainError("FORBIDDEN", "Sem acesso a esta galeria."));
    }

    const { error } = await supabase.rpc("reopen_gallery_selection", {
      p_gallery_id: galeriaId,
      p_days: dias,
    });
    if (error) {
      ctx.log.error("reopen_gallery_selection falhou", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível reabrir a galeria.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const { data: updated } = await supabase
      .from("galerias")
      .select("expires_at")
      .eq("id", galeriaId)
      .maybeSingle();

    await ctx.emit("gallery.reopened", {
      galeriaId,
      dias,
      motivo: motivo ?? null,
      photographerId: userId,
      newExpiresAt: updated?.expires_at ?? null,
    });

    return ok({ galeriaId, novoExpiresAt: updated?.expires_at ?? null });
  },
});
