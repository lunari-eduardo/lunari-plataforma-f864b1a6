import type { AuthUser } from "@/shared/ports";
import { domainError, err, ok, type Result, type DomainError } from "@/shared/result";

/**
 * Verifica se o usuário tem TODAS as permissões exigidas pela capability.
 * Regra: usuário com permissão "admin" passa em qualquer check.
 */
export function authorize(
  user: AuthUser | null,
  required: string[],
): Result<true, DomainError> {
  if (required.length === 0) return ok(true);
  if (!user) {
    return err(
      domainError("UNAUTHENTICATED", "Você precisa estar autenticado para executar essa ação.", {
        retriable: false,
      }),
    );
  }
  if (user.permissions.includes("admin") || user.roles.includes("admin")) return ok(true);
  const missing = required.filter((p) => !user.permissions.includes(p));
  if (missing.length > 0) {
    return err(
      domainError("FORBIDDEN", "Você não tem permissão para executar essa ação.", {
        retriable: false,
        details: { missing },
      }),
    );
  }
  return ok(true);
}
