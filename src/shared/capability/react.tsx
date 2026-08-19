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
import { kernel, webActor } from "@/shared/kernel";
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
  "clientes:read",
  "clientes:write",
  "clientes:delete",
  "leads:read",
  "leads:write",
  "leads:delete",
  "workflow:read",
  "workflow:write",
  "workflow:delete",
  "financeiro:read",
  "financeiro:write",
  "financeiro:delete",
  "finance:read",
  "finance:write",
  "finance:delete",
  "tarefas:read",
  "tarefas:write",
  "tarefas:delete",
  "tasks:read",
  "tasks:write",
  "tasks:delete",
  "precificacao:read",
  "precificacao:write",
  "precificacao:delete",
  "contratos:read",
  "contratos:write",
  "contratos:delete",
  "formularios:read",
  "formularios:write",
  "formularios:delete",
  "gallery:read",
  "gallery:write",
  "gallery:delete",
  "billing:read",
  "billing:write",
  "billing:create",
  "billing:delete",
  "configuracoes:read",
  "configuracoes:write",
  "automation:read",
  "automation:write",
  "automation:execute",
  "knowledge:read",
  "knowledge:write",
  "observation:read",
  "observation:write",
  "memory:read",
  "memory:write",
  "intelligence:read",
  "intelligence:write",
  "decision:read",
  "decision:write",
  "learning:read",
  "learning:write",
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
      return kernel.run<z.infer<TOut>>(capability, input, { actor: webActor(user) });
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
    queryFn: async () =>
      unwrap(await kernel.run<z.infer<TOut>>(capability, input, { actor: webActor(user) })),
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
      unwrap(await kernel.run<z.infer<TOut>>(capability, input, { actor: webActor(user) })),
  });
}
