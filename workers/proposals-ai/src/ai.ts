// Chamada aos provedores de IA via HTTP puro (mesma configuração do Assistente Lu:
// provider/model em app_settings, chave no cofre assistant_provider_keys,
// fallback Lovable AI Gateway).

import { Env, restSelect } from './supabase';

const DEFAULT_MODEL = 'gemini-2.5-flash';

interface AiConfig {
  provider: 'gemini' | 'deepseek' | 'openai' | 'lovable';
  model: string;
  apiKey: string;
}

async function resolveAiConfig(env: Env): Promise<AiConfig> {
  const [settingsRows, keyRows] = await Promise.all([
    restSelect<{ key: string; value: unknown }>(
      env,
      'app_settings',
      'key=in.(assistant_ai_provider,assistant_ai_model)&select=key,value'
    ),
    // Chaves do cofre (poucas linhas — filtradas por provider abaixo)
    restSelect<{ provider_name: string; api_key: string }>(
      env,
      'assistant_provider_keys',
      'select=provider_name,api_key'
    ),
  ]);

  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  const provider = (typeof settings.assistant_ai_provider === 'string'
    ? settings.assistant_ai_provider
    : 'lovable') as AiConfig['provider'];
  const model = typeof settings.assistant_ai_model === 'string' && settings.assistant_ai_model
    ? settings.assistant_ai_model
    : DEFAULT_MODEL;

  const vaultKey = keyRows.find((r) => r.provider_name === provider)?.api_key;

  if (provider === 'gemini' && vaultKey) {
    return { provider, model, apiKey: vaultKey };
  }
  if (provider === 'deepseek' && vaultKey) {
    return { provider, model, apiKey: vaultKey };
  }
  if (provider === 'openai' && vaultKey) {
    return { provider, model, apiKey: vaultKey };
  }
  // Fallback: Lovable AI Gateway (OpenAI-compatible)
  const lovableKey = vaultKey || env.LOVABLE_API_KEY || '';
  if (!lovableKey) throw new Error('Nenhuma chave de IA configurada (vault/lovable)');
  return { provider: 'lovable', model, apiKey: lovableKey };
}

/** Extrai o primeiro objeto/array JSON de uma resposta em texto. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error('Resposta da IA não contém JSON');
  const sliced = candidate.slice(start);
  for (let end = sliced.length; end > 1; end--) {
    const attempt = sliced.slice(0, end).trim();
    if (!/[\]}]$/.test(attempt)) continue;
    try {
      return JSON.parse(attempt);
    } catch {
      /* corta antes */
    }
  }
  throw new Error('Não foi possível interpretar o JSON da IA');
}

/** Completa um prompt exigindo saída JSON estrita. */
export async function completeJson(env: Env, system: string, user: string): Promise<unknown> {
  const cfg = await resolveAiConfig(env);
  const systemPrompt = `${system}\n\nResponda APENAS com JSON válido, sem texto ao redor, sem markdown.`;
  let text: string;

  if (cfg.provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  } else {
    // OpenAI-compatible: OpenAI, DeepSeek e Lovable Gateway
    const baseURL =
      cfg.provider === 'openai'
        ? 'https://api.openai.com/v1'
        : cfg.provider === 'deepseek'
          ? 'https://api.deepseek.com/beta'
          : 'https://ai.gateway.lovable.dev/v1';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.provider === 'lovable') headers['Lovable-API-Key'] = cfg.apiKey;
    else headers['Authorization'] = `Bearer ${cfg.apiKey}`;

    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: user },
        ],
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(`Provedor (${cfg.provider}) respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    text = data?.choices?.[0]?.message?.content ?? '';
  }

  if (!text.trim()) throw new Error('IA respondeu vazio');
  return extractJson(text);
}
