/**
 * AccessControlProvider — singleton global de `useAccessControl`.
 *
 * Antes: cada consumidor (Sidebar, ProtectedRoute, PlanRestrictionGuard,
 * TrialBanner, AgendaHeader, IntegracoesTab, etc.) instanciava o hook e
 * disparava sua própria RPC `get_access_state`. Em uma navegação simples
 * observamos 10+ chamadas para o mesmo endpoint.
 *
 * Agora: o provider chama o hook UMA vez e expõe o resultado. O hook
 * `useAccessControl` prefere o contexto; se estiver fora do provider,
 * cai no comportamento antigo (zero regressão para consumidores isolados).
 */
import * as React from "react";
import { useAccessControlInternal, type AccessControlValue } from "@/hooks/useAccessControl";

const AccessControlContext = React.createContext<AccessControlValue | null>(null);

export function AccessControlProvider({ children }: { children: React.ReactNode }) {
  const value = useAccessControlInternal();
  return (
    <AccessControlContext.Provider value={value}>
      {children}
    </AccessControlContext.Provider>
  );
}

/** Retorna o valor do contexto quando presente; caso contrário, `null`. */
export function useAccessControlContext(): AccessControlValue | null {
  return React.useContext(AccessControlContext);
}
