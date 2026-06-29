/**
 * Helper interno — resolve o `userId` autenticado a partir do contexto da
 * capability ou da sessão Supabase.
 */
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok, type DomainError, type Result } from "@/shared/result";
import type { CapabilityContext } from "@/shared/capability";

export async function resolveUserId(
  ctx: CapabilityContext,
): Promise<Result<string, DomainError>> {
  const ctxId = ctx.user?.id;
  if (ctxId) return ok(ctxId);
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
  return ok(id);
}
