/**
 * useForegroundResync — Safari iOS derruba WebSockets quando a aba
 * fica em background por >30s. Este hook detecta o retorno ao
 * foreground e dispara invalidateQueries com as chaves fornecidas,
 * garantindo que finanças/agenda/kanban ressincronizem sem F5.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface Options {
  /** Chaves de query a invalidar ao voltar para foreground. */
  queryKeys: readonly (string | readonly unknown[])[];
  /** Callback custom opcional (ex.: refetch manual de realtime). */
  onResume?: () => void;
  /** Debounce mínimo entre duas invalidações consecutivas (ms). */
  minIntervalMs?: number;
}

export function useForegroundResync({
  queryKeys,
  onResume,
  minIntervalMs = 5_000,
}: Options) {
  const qc = useQueryClient();

  useEffect(() => {
    let lastRun = 0;

    const trigger = () => {
      const now = Date.now();
      if (now - lastRun < minIntervalMs) return;
      lastRun = now;

      queryKeys.forEach((key) => {
        qc.invalidateQueries({
          queryKey: Array.isArray(key) ? key : [key],
        });
      });
      onResume?.();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') trigger();
    };

    const onOnline = () => trigger();
    const onFocus = () => trigger();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
    };
    // queryKeys é geralmente estável (const literal). Se mudar em runtime, o
    // consumer deve estabilizar com useMemo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, onResume, minIntervalMs]);
}

export default useForegroundResync;
