import { createContext, useContext, ReactNode } from 'react';
import { useClientesRealtime as useClientesRealtimeInternal } from '@/hooks/useClientesRealtime';

type Ctx = ReturnType<typeof useClientesRealtimeInternal>;

const ClientesRealtimeContext = createContext<Ctx | null>(null);

/**
 * Provider global de clientes em tempo real.
 * Instancia UMA única vez o hook `useClientesRealtime` para toda a árvore,
 * evitando (1) múltiplas subscriptions no mesmo canal Postgres (que se
 * derrubam mutuamente ao desmontar) e (2) N chamadas `select * from clientes`
 * concorrentes.
 */
export function ClientesRealtimeProvider({ children }: { children: ReactNode }) {
  const value = useClientesRealtimeInternal();
  return (
    <ClientesRealtimeContext.Provider value={value}>
      {children}
    </ClientesRealtimeContext.Provider>
  );
}

/**
 * Drop-in replacement do hook `useClientesRealtime` original.
 * Se estiver dentro do Provider, retorna a instância compartilhada.
 * Caso contrário, faz fallback para uma instância local (compatibilidade).
 */
export function useClientesRealtime(): Ctx {
  const ctx = useContext(ClientesRealtimeContext);
  // Fallback: componentes fora do provider ainda funcionam de forma isolada.
  // Evita crash durante refactor incremental.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const local = ctx ? null : useClientesRealtimeInternal();
  return (ctx ?? local) as Ctx;
}
