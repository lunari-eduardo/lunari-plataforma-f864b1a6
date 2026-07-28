/**
 * Agrupa linhas do extrato em blocos temporais amigáveis:
 * Hoje · Ontem · Esta semana · Este mês · <Mês> (para meses anteriores).
 */
import { format, isToday, isYesterday, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LinhaExtrato } from '@/types/extrato';

export interface TimelineGroup {
  key: string;
  label: string;
  sublabel?: string;
  linhas: LinhaExtrato[];
}

function safeDate(iso: string): Date | null {
  if (!iso) return null;
  try {
    const d = iso.length === 10 ? parseISO(`${iso}T12:00:00`) : parseISO(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function bucketKey(d: Date): { key: string; label: string; sublabel?: string; order: number } {
  if (isToday(d)) {
    return { key: 'hoje', label: 'Hoje', sublabel: format(d, "d 'de' MMMM", { locale: ptBR }), order: 0 };
  }
  if (isYesterday(d)) {
    return { key: 'ontem', label: 'Ontem', sublabel: format(d, "d 'de' MMMM", { locale: ptBR }), order: 1 };
  }
  if (isThisWeek(d, { weekStartsOn: 1 })) {
    return { key: 'semana', label: 'Esta semana', order: 2 };
  }
  if (isThisMonth(d)) {
    return { key: 'mes', label: 'Este mês', order: 3 };
  }
  const y = d.getFullYear();
  const m = d.getMonth();
  const label = format(d, "MMMM 'de' yyyy", { locale: ptBR });
  return {
    key: `m-${y}-${m}`,
    label: label.charAt(0).toUpperCase() + label.slice(1),
    order: 100 - (y * 12 + m),
  };
}

export function groupByTimeline(linhas: LinhaExtrato[]): TimelineGroup[] {
  const map = new Map<string, TimelineGroup & { order: number }>();
  linhas.forEach((l) => {
    const d = safeDate(l.data);
    if (!d) return;
    const b = bucketKey(d);
    const existing = map.get(b.key);
    if (existing) {
      existing.linhas.push(l);
    } else {
      map.set(b.key, { key: b.key, label: b.label, sublabel: b.sublabel, linhas: [l], order: b.order });
    }
  });
  return Array.from(map.values())
    .sort((a, b) => a.order - b.order)
    .map(({ order: _o, ...g }) => g);
}
