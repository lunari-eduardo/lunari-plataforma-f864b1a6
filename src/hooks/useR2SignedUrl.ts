/**
 * Resolve uma URL pré-assinada para um objeto privado no R2.
 * Cache em memória por ~4 minutos (URL expira em 5).
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 4 * 60 * 1000;

export async function resolveR2SignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  const cached = CACHE.get(storagePath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.functions.invoke('r2-signed-url', {
    body: { storagePath, expiresIn: 300 },
  });
  if (error || !data?.url) return null;
  CACHE.set(storagePath, { url: data.url, expiresAt: Date.now() + CACHE_TTL_MS });
  return data.url;
}

export async function deleteR2Object(storagePath: string): Promise<boolean> {
  if (!storagePath) return true;
  const { data, error } = await supabase.functions.invoke('r2-delete', {
    body: { storagePath },
  });
  CACHE.delete(storagePath);
  if (error) return false;
  return !!data?.success;
}

export function useR2SignedUrl(storagePath: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!storagePath) {
      setUrl(null);
      return;
    }
    setLoading(true);
    const u = await resolveR2SignedUrl(storagePath);
    setUrl(u);
    setLoading(false);
  }, [storagePath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { url, loading, refresh };
}
