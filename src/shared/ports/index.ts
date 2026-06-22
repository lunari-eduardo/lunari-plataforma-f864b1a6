/**
 * Ports compartilhados entre módulos. Módulos podem declarar ports adicionais
 * em `src/modules/<modulo>/ports/`. Implementações vivem em `infrastructure/`.
 */

export interface Clock {
  now(): Date;
  /** Retorna ISO string em UTC. */
  isoNow(): string;
}

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}

export interface AuthUser {
  id: string;
  email: string | null;
  roles: string[];
  /** Permissões resolvidas (RBAC + plano + ownership). */
  permissions: string[];
}

export interface AuthPort {
  /** Sessão atual ou null se não autenticado. */
  currentUser(): Promise<AuthUser | null>;
  /** Atalho: lança se não autenticado. */
  requireUser(): Promise<AuthUser>;
}

export interface NotifierPort {
  toastSuccess?(message: string): void;
  toastError(message: string): void;
}

export interface IdempotencyStore {
  /** Retorna resultado anterior se já existir, senão executa fn e armazena. */
  once<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T>;
}

export interface AuditLogger {
  record(entry: {
    capabilityId: string;
    actorId: string | null;
    input: unknown;
    output?: unknown;
    error?: unknown;
    durationMs: number;
    occurredAt: string;
  }): Promise<void>;
}
