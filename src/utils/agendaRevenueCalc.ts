import { isSameDay, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import type { UnifiedEvent } from '@/modules/agenda/presentation';
import type { Appointment } from '@/modules/agenda/presentation';

export interface RevenueSummary {
  total: number;
  paid: number;
  pending: number;
  paidPct: number;
  count: number;
  confirmedCount: number;
  toConfirmCount: number;
  fromBudgetCount: number;
}

/**
 * Calculates the appointment value from packageId + products lookup.
 * Falls back to 0 when data is missing — never throws.
 */
export function getAppointmentValue(appointment: Appointment, pacotes: any[]): number {
  let total = 0;

  if (appointment.packageId && pacotes && pacotes.length > 0) {
    const pkg = pacotes.find((p) => p.id === appointment.packageId);
    if (pkg) {
      const pkgValue = Number(pkg.valor ?? pkg.valor_base ?? pkg.valorVenda ?? 0);
      if (!isNaN(pkgValue)) total += pkgValue;
    }
  }

  if (appointment.produtosIncluidos && appointment.produtosIncluidos.length > 0) {
    for (const prod of appointment.produtosIncluidos) {
      if (prod.tipo === 'manual') {
        const unit = Number(prod.valorUnitario || 0);
        const qty = Number(prod.quantidade || 0);
        if (!isNaN(unit) && !isNaN(qty)) total += unit * qty;
      }
    }
  }

  return total;
}

export function summarizeRevenue(
  events: UnifiedEvent[],
  pacotes: any[],
  range: { start: Date; end?: Date }
): RevenueSummary {
  const summary: RevenueSummary = {
    total: 0,
    paid: 0,
    pending: 0,
    paidPct: 0,
    count: 0,
    confirmedCount: 0,
    toConfirmCount: 0,
    fromBudgetCount: 0,
  };

  for (const event of events) {
    if (event.type !== 'appointment') continue;

    const inRange = range.end
      ? isWithinInterval(event.date, { start: range.start, end: range.end })
      : isSameDay(event.date, range.start);
    if (!inRange) continue;

    const apt = event.originalData as Appointment;
    const value = getAppointmentValue(apt, pacotes);
    const paid = Number(apt.paidAmount || 0);

    summary.total += value;
    summary.paid += paid;
    summary.count += 1;

    if (apt.status === 'confirmado') summary.confirmedCount += 1;
    else if (apt.status === 'a confirmar') summary.toConfirmCount += 1;
    if ((apt as any).origem === 'orcamento') summary.fromBudgetCount += 1;
  }

  summary.pending = Math.max(0, summary.total - summary.paid);
  summary.paidPct = summary.total > 0 ? Math.round((summary.paid / summary.total) * 100) : 0;

  return summary;
}

export function getWeekRange(date: Date) {
  return { start: startOfWeek(date), end: endOfWeek(date) };
}
