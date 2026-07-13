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
 * Retorna a instância compartilhada montada pelo Provider.
 * O Provider é montado em `App.tsx` acima de todas as rotas autenticadas.
 */
export function useClientesRealtimeContext(): Ctx {
  const ctx = useContext(ClientesRealtimeContext);
  if (!ctx) {
    throw new Error(
      'useClientesRealtimeContext deve ser usado dentro de <ClientesRealtimeProvider>'
    );
  }
  return ctx;
}
