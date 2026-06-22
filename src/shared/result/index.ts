/**
 * Result<Ok, Err> — tipo discriminado para operações que podem falhar
 * sem lançar exceção. Usado por todas as capabilities Lunari.
 */
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = DomainError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new Error(
    `unwrap on Err: ${typeof r.error === "object" ? JSON.stringify(r.error) : String(r.error)}`,
  );
}

/**
 * DomainError — formato canônico de erro de negócio.
 * `code` é estável (não localizar). `message` é PT-BR para usuário final.
 * `details` é opcional para debug.
 */
export interface DomainError {
  code: string;
  message: string;
  retriable?: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export const domainError = (
  code: string,
  message: string,
  extra: Partial<DomainError> = {},
): DomainError => ({ code, message, ...extra });
