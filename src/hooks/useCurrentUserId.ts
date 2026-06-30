/**
 * Atalho para obter o `userId` do `AuthContext` sem precisar chamar
 * `supabase.auth.getUser()` (que dispara uma requisição HTTP a /auth/v1/user
 * e contribui para a "tempestade de queries" no boot do app).
 */
import { useAuth } from '@/contexts/AuthContext';

export function useCurrentUserId(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}
