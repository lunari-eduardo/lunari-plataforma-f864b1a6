import { useEffect, useRef, useState, useCallback } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAppointmentAutosaveOptions<T> {
  data: T;
  enabled: boolean;
  delay?: number;
  /** Build the persisted payload from the current data snapshot. */
  buildPayload: (data: T) => any;
  /** Persist the payload. Should throw on error. */
  onSave: (payload: any) => Promise<void> | void;
}

/**
 * Auto-save para o modal de agendamento pendente.
 * - Debounce padrão 800ms
 * - flushNow() executa salvamento imediato (usar antes de cobrança/fechar modal)
 * - Não dispara no mount (snapshot inicial)
 * - Atualiza snapshot após cada save bem-sucedido
 */
export function useAppointmentAutosave<T>({
  data,
  enabled,
  delay = 800,
  buildPayload,
  onSave,
}: UseAppointmentAutosaveOptions<T>) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const lastSavedSnapshotRef = useRef<string>(JSON.stringify(data));
  const isSavingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<T>(data);
  const buildPayloadRef = useRef(buildPayload);
  const onSaveRef = useRef(onSave);
  const enabledRef = useRef(enabled);
  const cooldownUntilRef = useRef<number>(0);

  // Sempre manter refs atualizadas (evita closures stale)
  useEffect(() => {
    buildPayloadRef.current = buildPayload;
    onSaveRef.current = onSave;
    enabledRef.current = enabled;
    pendingDataRef.current = data;
  });

  const performSave = useCallback(async (snapshotJson: string, snapshotData: T) => {
    if (isSavingRef.current) return;
    if (Date.now() < cooldownUntilRef.current) return;
    isSavingRef.current = true;
    setStatus('saving');
    try {
      const payload = buildPayloadRef.current(snapshotData);
      await onSaveRef.current(payload);
      lastSavedSnapshotRef.current = snapshotJson;
      setLastSavedAt(new Date());
      setStatus('saved');
      // Volta a 'idle' após 2s
      setTimeout(() => {
        setStatus((s) => (s === 'saved' ? 'idle' : s));
      }, 2000);
    } catch (err) {
      console.error('[useAppointmentAutosave] Erro ao salvar:', err);
      setStatus('error');
      // Cooldown 400ms para evitar re-disparos em cascata após revert/StrictMode
      cooldownUntilRef.current = Date.now() + 400;
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  // Agendamento debounced
  useEffect(() => {
    if (!enabled) return;
    const snapshotJson = JSON.stringify(data);
    if (snapshotJson === lastSavedSnapshotRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      performSave(snapshotJson, data);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, enabled, delay, performSave]);

  // Aviso ao tentar fechar a aba com save pendente
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const pending = JSON.stringify(pendingDataRef.current) !== lastSavedSnapshotRef.current;
      if (enabledRef.current && (pending || isSavingRef.current)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  /** Salva imediatamente o estado atual, ignorando o debounce. */
  const flushNow = useCallback(async () => {
    if (!enabledRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const snapshotJson = JSON.stringify(pendingDataRef.current);
    if (snapshotJson === lastSavedSnapshotRef.current) return;
    await performSave(snapshotJson, pendingDataRef.current);
  }, [performSave]);

  /** Permite reinicializar o snapshot (ex.: prop appointment trocou via realtime) */
  const resetSnapshot = useCallback((newData: T) => {
    lastSavedSnapshotRef.current = JSON.stringify(newData);
    setStatus('idle');
  }, []);

  return { status, lastSavedAt, flushNow, resetSnapshot };
}
