/**
 * SessionTimeline — histórico da sessão em linha do tempo vertical.
 * Carrega sob demanda (só quando a linha colapsável é aberta).
 */
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreditCard, DollarSign, Edit3, Plus, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  at: string;
  title: string;
  detail?: string;
  valor?: number;
  icon: LucideIcon;
  tone: 'neutral' | 'success' | 'warning';
}

const TONE_DOT: Record<TimelineEvent['tone'], string> = {
  neutral: 'bg-muted-foreground/40',
  success: 'bg-lunar-success',
  warning: 'bg-lunar-warning',
};

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function SessionTimeline({ sessionId }: { sessionId?: string }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!sessionId) {
        setEvents([]);
        return;
      }
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id;
        if (!userId) {
          setEvents([]);
          return;
        }

        const [sessaoRes, transacoesRes, cobrancasRes] = await Promise.all([
          supabase
            .from('clientes_sessoes')
            .select('created_at, updated_at, status')
            .eq('session_id', sessionId)
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('clientes_transacoes')
            .select('id, valor, tipo, descricao, created_at, data_transacao')
            .eq('session_id', sessionId)
            .eq('user_id', userId),
          supabase
            .from('cobrancas')
            .select('id, valor, status, tipo_cobranca, provedor, created_at, data_pagamento')
            .eq('session_id', sessionId)
            .eq('user_id', userId),
        ]);

        const list: TimelineEvent[] = [];

        const sessao = sessaoRes.data as any;
        if (sessao?.created_at) {
          list.push({
            id: 'sessao-criada',
            at: sessao.created_at,
            title: 'Sessão criada',
            icon: Plus,
            tone: 'neutral',
          });
        }
        if (sessao?.updated_at && sessao.updated_at !== sessao.created_at) {
          list.push({
            id: 'sessao-editada',
            at: sessao.updated_at,
            title: 'Sessão atualizada',
            detail: sessao.status ? `Status: ${sessao.status}` : undefined,
            icon: Edit3,
            tone: 'neutral',
          });
        }

        for (const c of (cobrancasRes.data as any[]) || []) {
          list.push({
            id: `cob-${c.id}`,
            at: c.created_at,
            title: 'Cobrança gerada',
            detail: [c.tipo_cobranca?.toUpperCase(), c.provedor].filter(Boolean).join(' • '),
            valor: c.valor_principal != null ? Number(c.valor_principal) : Number(c.valor) || 0,
            icon: CreditCard,
            tone: 'neutral',
          });
          if (c.status === 'pago' && c.data_pagamento) {
            list.push({
              id: `cob-pago-${c.id}`,
              at: c.data_pagamento,
              title: 'Cobrança paga',
              valor: c.valor_principal != null ? Number(c.valor_principal) : Number(c.valor) || 0,
              icon: Receipt,
              tone: 'success',
            });
          }
        }

        for (const t of (transacoesRes.data as any[]) || []) {
          const isEstorno = Number(t.valor) < 0 || t.tipo === 'estorno';
          list.push({
            id: `tx-${t.id}`,
            at: t.created_at || t.data_transacao,
            title: isEstorno ? 'Estorno registrado' : 'Pagamento registrado',
            detail: t.descricao || undefined,
            valor: Number(t.valor) || 0,
            icon: DollarSign,
            tone: isEstorno ? 'warning' : 'success',
          });
        }

        list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        if (!cancelled) setEvents(list);
      } catch {
        if (!cancelled) setEvents([]);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (events === null) {
    return (
      <div className="space-y-2 py-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-8 rounded-md bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem eventos ainda.</p>;
  }

  return (
    <ol className="relative space-y-3 pl-4">
      <span className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-border/70" aria-hidden />
      {events.map(ev => {
        const Icon = ev.icon;
        return (
          <li key={ev.id} className="relative">
            <span
              className={cn(
                'absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                TONE_DOT[ev.tone],
              )}
              aria-hidden
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm text-foreground">
                  <Icon className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                  <span className="truncate">{ev.title}</span>
                </p>
                {ev.detail && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{ev.detail}</p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {ev.at
                    ? format(new Date(ev.at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })
                    : '—'}
                </p>
              </div>
              {typeof ev.valor === 'number' && ev.valor !== 0 && (
                <span
                  className={cn(
                    'shrink-0 text-sm tabular-nums',
                    ev.tone === 'success'
                      ? 'text-lunar-success'
                      : ev.tone === 'warning'
                        ? 'text-lunar-warning'
                        : 'text-foreground',
                  )}
                >
                  {brl(ev.valor)}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default SessionTimeline;
