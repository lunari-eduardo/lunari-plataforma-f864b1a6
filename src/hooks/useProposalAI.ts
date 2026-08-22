import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================================
// IA DO CONSTRUTOR DE PROPOSTAS
// Clientes finos do Cloudflare Worker lunari-proposals-ai
// (rotas /proposal-generate e /proposal-ai-field).
// A URL vem de VITE_PROPOSALS_AI_URL (ex.: https://lunari-proposals-ai.sua-conta.workers.dev
// ou https://ia.lunarihub.com). O token do usuário logado é enviado no
// Authorization e validado pelo Worker junto ao Supabase.
// ============================================================

export interface ProposalBriefing {
  session_type: string;
  client_name?: string;
  tone?: string;
  highlights?: string;
  photographer_name?: string;
  packages?: { name: string; price: string; features: string[] }[];
  /** Referências de layout/design (URLs públicas do R2 — imagens e PDF) */
  references?: { url: string; mime_type: string; name?: string }[];
  /** Textos de referência enviados inline (txt/md) */
  reference_texts?: { name: string; content: string }[];
}

export interface GeneratedProposal {
  blocks: { id?: string; type: string; content: Record<string, any>; props?: Record<string, any> }[];
  design_tokens?: {
    colors?: Record<string, string>;
    typography?: { display?: string; body?: string };
  };
}

function getWorkerBaseUrl(): string {
  const url = import.meta.env.VITE_PROPOSALS_AI_URL as string | undefined;
  if (!url) {
    throw new Error('Serviço de IA não configurado (variável VITE_PROPOSALS_AI_URL ausente).');
  }
  return url.replace(/\/$/, '');
}

async function invokeWorker<T>(path: string, body: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch(`${getWorkerBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as any)?.error || `Erro ${res.status} no serviço de IA`);
  }
  if (data && typeof data === 'object' && 'error' in data && (data as any).error) {
    throw new Error((data as any).error);
  }
  return data as T;
}

export function useProposalGenerate() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (briefing: ProposalBriefing): Promise<GeneratedProposal | null> => {
    setIsGenerating(true);
    try {
      return await invokeWorker<GeneratedProposal>('/proposal-generate', { mode: 'full', briefing });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Falha ao gerar proposta com IA. Tente novamente.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, isGenerating };
}

export type AiFieldAction = 'improve' | 'rewrite' | 'shorten' | 'expand';

export function useAiFieldRewrite() {
  const [pendingField, setPendingField] = useState<string | null>(null);

  const rewrite = useCallback(async (params: {
    action: AiFieldAction;
    blockType: string;
    fieldLabel: string;
    currentText: string;
    context?: { materialTitle?: string; sessionType?: string; tone?: string };
    fieldKey: string; // identificador para o estado de loading
  }): Promise<string | null> => {
    setPendingField(params.fieldKey);
    try {
      const data = await invokeWorker<{ text: string }>('/proposal-ai-field', {
        action: params.action,
        block_type: params.blockType,
        field_label: params.fieldLabel,
        current_text: params.currentText,
        context: {
          material_title: params.context?.materialTitle,
          session_type: params.context?.sessionType,
          tone: params.context?.tone,
        },
      });
      return data.text;
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'A IA não conseguiu reescrever este campo.');
      return null;
    } finally {
      setPendingField(null);
    }
  }, []);

  return { rewrite, pendingField };
}

export interface OutlineSuggestion {
  type: string;
  reason: string;
}

export function useProposalOutline() {
  const [isLoading, setIsLoading] = useState(false);

  const suggest = useCallback(async (briefing: ProposalBriefing): Promise<OutlineSuggestion[] | null> => {
    setIsLoading(true);
    try {
      const data = await invokeWorker<{ outline: OutlineSuggestion[] }>('/proposal-generate', { mode: 'outline', briefing });
      return data.outline ?? [];
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Falha ao sugerir estrutura.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { suggest, isLoading };
}

// Paletas prontas para o assistente de design (aplicam design_tokens)
export const DESIGN_PRESETS: { name: string; description: string; tokens: NonNullable<GeneratedProposal['design_tokens']> }[] = [
  {
    name: 'Editorial Clássico',
    description: 'Tons quentes de terra, serifado elegante',
    tokens: {
      colors: { cream: '#F3F0EA', linen: '#E8E3DA', stone: '#C9BFB2', taupe: '#8C7B6E', accent: '#7A5C42', ink: '#1A1714', white: '#FFFFFF' },
      typography: { display: 'Cormorant Garamond', body: 'Jost' },
    },
  },
  {
    name: 'Terracota Convidativo',
    description: 'Acolhedor, destaque em terracota',
    tokens: {
      colors: { cream: '#FDFBF7', linen: '#F0E9E1', stone: '#D8C7B8', taupe: '#8A7364', accent: '#C86A46', ink: '#2C2825', white: '#FFFFFF' },
      typography: { display: 'Playfair Display', body: 'Inter' },
    },
  },
  {
    name: 'Noite Sofisticada',
    description: 'Escuro, contraste alto, dourado discreto',
    tokens: {
      colors: { cream: '#232019', linen: '#3A342A', stone: '#8C7B6E', taupe: '#A89B8C', accent: '#C9A227', ink: '#141210', white: '#F5F2EC' },
      typography: { display: 'Cormorant Garamond', body: 'Jost' },
    },
  },
  {
    name: 'Clean Minimal',
    description: 'Claro, neutro, cinza pedra',
    tokens: {
      colors: { cream: '#FAFAF8', linen: '#EFEFEC', stone: '#C4C4C0', taupe: '#6E6E6A', accent: '#4A4A46', ink: '#212121', white: '#FFFFFF' },
      typography: { display: 'Playfair Display', body: 'Inter' },
    },
  },
];
