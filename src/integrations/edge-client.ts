import { supabase } from '@/integrations/supabase/client';

const PREVIEWS_BASE = import.meta.env.VITE_EDGE_PREVIEWS_URL || 'https://lunari-edge-previews.eduardo22diehl.workers.dev';
const API_BASE = import.meta.env.VITE_EDGE_API_URL || 'https://lunari-edge-api.eduardo22diehl.workers.dev';

export interface EdgeInvokeOptions {
  body?: any;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export async function invokeEdgeWorker<T = any>(
  workerType: 'previews' | 'api',
  functionName: string,
  options: EdgeInvokeOptions = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const baseUrl = workerType === 'previews' ? PREVIEWS_BASE : API_BASE;
    const url = `${baseUrl}/functions/v1/${functionName}`;
    const method = options.method || (options.body ? 'POST' : 'GET');

    const headers: Record<string, string> = {
      ...(options.headers || {}),
    };

    // Obter sessão atual para repassar Authorization se houver
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.access_token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
    }

    let bodyPayload: BodyInit | undefined = undefined;
    if (options.body instanceof FormData) {
      bodyPayload = options.body;
      // Fetch cuida do Content-Type multipart automaticamente
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      bodyPayload = JSON.stringify(options.body);
    }

    const res = await fetch(url, {
      method,
      headers,
      body: bodyPayload,
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr = errText;
      try {
        parsedErr = JSON.parse(errText).error || errText;
      } catch {}
      throw new Error(parsedErr || `Edge worker error: ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return { data, error: null };
    } else {
      const text = await res.text();
      return { data: text as unknown as T, error: null };
    }
  } catch (err: any) {
    console.warn(`[invokeEdgeWorker:${functionName}] Falha na chamada ao Cloudflare Worker:`, err);
    // Fallback gracioso para o Supabase Edge Functions caso ocorra falha de rede
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: options.body,
        headers: options.headers,
      });
      return { data, error: error ? new Error(error.message) : null };
    } catch (supabaseErr: any) {
      return { data: null, error: err };
    }
  }
}
