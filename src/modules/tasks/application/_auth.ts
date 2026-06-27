/**
 * Helper interno — resolve o `userId` autenticado a partir do contexto da
 * capability ou da sessão Supabase. Capabilities executam tanto via UI quanto
 * via Lu/AI, então não podem assumir um único caminho de auth.
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
