/**
 * AccessControlProvider — singleton global. Roda `useAccessControlInternal`
 * uma única vez e injeta em `AccessControlCtx`. Todos os consumidores
 * (Sidebar, ProtectedRoute, PlanRestrictionGuard, TrialBanner, etc.)
 * passam a ler do contexto em vez de disparar RPC próprio.
 */
import * as React from "react";
import {
  AccessControlCtx,
  useAccessControlInternal,
  type AccessControlValue,
} from "@/hooks/useAccessControl";

export function AccessControlProvider({ children }: { children: React.ReactNode }) {
  const value = useAccessControlInternal();
  return (
    <AccessControlCtx.Provider value={value}>
      {children}
    </AccessControlCtx.Provider>
  );
}

export function useAccessControlContext(): AccessControlValue | null {
  return React.useContext(AccessControlCtx);
}
