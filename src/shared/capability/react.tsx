/**
 * Ponte React ⇄ Capabilities.
 *
 * - `CapabilityRuntimeProvider` lê o usuário autenticado (Supabase) e o
 *   transforma em `AuthUser` (shape esperado pelo motor de capabilities).
 * - `useAuthUser()` devolve o `AuthUser | null` atual.
 * - `useRunCapability()` devolve uma função que executa qualquer capability
 *   injetando o usuário e tratando o `Result`.
 * - `useCapabilityQuery()` / `useCapabilityMutation()` integram com TanStack
 *   Query mantendo o contrato `Result` (lança o `DomainError` na rejeição
 *   para que `isError`/`onError` funcionem como em qualquer outra query).
 *
 * Esta camada é compartilhada por TODOS os módulos — não importa nada de
 * `src/modules/*` aqui.
 */
import * as React from "react";
import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import type { AuthUser } from "@/shared/ports";
import { isOk, type DomainError, type Result } from "@/shared/result";
import type { Capability } from "./types";
import type { z, ZodTypeAny } from "zod";

/**
 * Permissões padrão concedidas a qualquer usuário autenticado enquanto o
 * RBAC granular não está disponível. À medida que cada módulo migrar para a
 * arquitetura de capabilities, refine aqui (ex.: ler plano/role do JWT).
 */
const DEFAULT_USER_PERMISSIONS: string[] = [
  "agenda:read",
  "agenda:write",
  "agenda:delete",
  "crm:read",
  "crm:write",
  "crm:delete",
  "workflow:read",
  "workflow:write",
  "workflow:delete",
  "financeiro:read",
  "financeiro:write",
  "financeiro:delete",
  "tarefas:read",
  "tarefas:write",
  "tarefas:delete",
  // Onda 4b — IDs canônicos do módulo `tasks` (alinhados ao registry).
  "tasks:read",
  "tasks:write",
  "tasks:delete",
  // Onda 5b — IDs canônicos do módulo `finance` (alinhados às capabilities `finance.*`).
  "finance:read",
  "finance:write",
  "finance:delete",
];

interface CapabilityRuntimeValue {
  user: AuthUser | null;
  loading: boolean;
}

const CapabilityRuntimeContext = React.createContext<CapabilityRuntimeValue>({
  user: null,
  loading: true,
});

export const CapabilityRuntimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  const value = React.useMemo<CapabilityRuntimeValue>(() => {
    if (!user) return { user: null, loading };
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const roles = Array.isArray(meta.roles) ? (meta.roles as string[]) : ["user"];
    const isAdmin = roles.includes("admin");
    const authUser: AuthUser = {
      id: user.id,
      email: user.email ?? null,
      roles,
      permissions: isAdmin ? ["admin", ...DEFAULT_USER_PERMISSIONS] : DEFAULT_USER_PERMISSIONS,
    };
    return { user: authUser, loading };
  }, [user, loading]);

  return (
    <CapabilityRuntimeContext.Provider value={value}>{children}</CapabilityRuntimeContext.Provider>
  );
};

export function useCapabilityRuntime(): CapabilityRuntimeValue {
  return React.useContext(CapabilityRuntimeContext);
}

export function useAuthUser(): AuthUser | null {
  return useCapabilityRuntime().user;
}

/**
 * Erro lançado quando uma capability resolve com `Err`. Carrega o `DomainError`
 * original para o consumidor inspecionar (code, retriable, details).
 */
export class CapabilityError extends Error {
  readonly domain: DomainError;
  constructor(domain: DomainError) {
    super(domain.message);
    this.name = "CapabilityError";
    this.domain = domain;
  }
}

function unwrap<T>(result: Result<T, DomainError>): T {
  if (isOk(result)) return result.value;
  throw new CapabilityError(result.error);
}

/**
 * Executa uma capability injetando o usuário atual. Retorna o `Result` bruto
 * para quem prefere lidar com ele explicitamente (sem React Query).
 */
export function useRunCapability() {
  const { user } = useCapabilityRuntime();
  return React.useCallback(
    async <TIn extends ZodTypeAny, TOut extends ZodTypeAny>(
      capability: Capability<TIn, TOut>,
      input: z.infer<TIn>,
    ): Promise<Result<z.infer<TOut>, DomainError>> => {
      return capability.execute(input, { user, runtime: "client" });
    },
    [user],
  );
}

interface CapabilityQueryOptions<TOut>
  extends Omit<UseQueryOptions<TOut, CapabilityError, TOut, readonly unknown[]>, "queryKey" | "queryFn"> {
  queryKey: readonly unknown[];
}

/**
 * Wrapper sobre `useQuery` que executa uma capability tipada.
 * - `queryKey` é responsabilidade do chamador (use factories por módulo).
 * - `enabled` desliga automaticamente quando o usuário ainda não carregou.
 */
export function useCapabilityQuery<TIn extends ZodTypeAny, TOut extends ZodTypeAny>(
  capability: Capability<TIn, TOut>,
  input: z.infer<TIn>,
  options: CapabilityQueryOptions<z.infer<TOut>>,
) {
  const { user, loading } = useCapabilityRuntime();
  const enabled = (options.enabled ?? true) && !loading;
  return useQuery<z.infer<TOut>, CapabilityError, z.infer<TOut>, readonly unknown[]>({
    ...options,
    enabled,
    queryFn: async () => unwrap(await capability.execute(input, { user, runtime: "client" })),
  });
}

interface CapabilityMutationOptions<TIn, TOut>
  extends Omit<UseMutationOptions<TOut, CapabilityError, TIn>, "mutationFn"> {}

export function useCapabilityMutation<TIn extends ZodTypeAny, TOut extends ZodTypeAny>(
  capability: Capability<TIn, TOut>,
  options: CapabilityMutationOptions<z.infer<TIn>, z.infer<TOut>> = {},
) {
  const { user } = useCapabilityRuntime();
  return useMutation<z.infer<TOut>, CapabilityError, z.infer<TIn>>({
    ...options,
    mutationFn: async (input) =>
      unwrap(await capability.execute(input, { user, runtime: "client" })),
  });
}
