/**
 * Registry global de canais Supabase Realtime.
 *
 * Vive em `globalThis` para sobreviver a duplicação de módulo por
 * code-splitting (múltiplas cópias do mesmo arquivo em chunks diferentes
 * continuam apontando para o MESMO Map). Isso impede o erro:
 *
 *   "cannot add postgres_changes callbacks ... after subscribe()"
 *
 * Cada entrada é criada uma única vez por chave. Consumidores só fazem
 * acquire/release; callbacks são anexados apenas na criação.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Entry {
  channel: RealtimeChannel;
  refCount: number;
  disposeTimer?: ReturnType<typeof setTimeout> | null;
}

const KEY = '__lunari_realtime_registry_v1__';
const g = globalThis as unknown as Record<string, { channels: Map<string, Entry> } | undefined>;
const store = (g[KEY] ??= { channels: new Map<string, Entry>() });
const DISPOSE_GRACE_MS = 5_000;

/**
 * Adquire (ou cria) um canal singleton por `key`.
 * `factory` é chamada APENAS na primeira aquisição. É responsabilidade
 * dela anexar os `.on()` e chamar `.subscribe()` antes de retornar.
 */
export function acquireChannel(
  key: string,
  factory: () => RealtimeChannel,
): RealtimeChannel {
  const existing = store.channels.get(key);
  if (existing) {
    if (existing.disposeTimer) {
      clearTimeout(existing.disposeTimer);
      existing.disposeTimer = null;
    }
    existing.refCount++;
    return existing.channel;
  }
  const channel = factory();
  store.channels.set(key, { channel, refCount: 1, disposeTimer: null });
  return channel;
}

/**
 * Libera uma referência. Remove o canal do Supabase quando o último
 * consumidor sai.
 */
export function releaseChannel(key: string): void {
  const entry = store.channels.get(key);
  if (!entry) return;
  if (entry.refCount <= 0) return;
  entry.refCount--;
  if (entry.refCount === 0 && !entry.disposeTimer) {
    // React StrictMode, chunk hydration and fast card expand/collapse can
    // remount the same hook while Supabase is still removing the old topic.
    // Keep the subscribed channel warm briefly so the next acquire reuses it
    // instead of calling `.on()` on a channel Supabase still considers active.
    entry.disposeTimer = setTimeout(() => {
      const latest = store.channels.get(key);
      if (!latest || latest !== entry || latest.refCount > 0) return;
      latest.disposeTimer = null;
    try {
        supabase.removeChannel(latest.channel);
    } catch {
      /* noop */
    }
    store.channels.delete(key);
    }, DISPOSE_GRACE_MS);
  }
}
