/**
 * Seção 2 — Acompanhamento.
 * Agenda financeira (próximos vencimentos) + Pendências (vencidos / a receber vencido).
 */
import { memo, useMemo } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';

interface Tx {
  id: string;
  valor: number;
  dataVencimento: string;
  status: string;
  observacoes?: string;
  item?: { id: string; nome: string; grupo_principal: string } | null;
}
interface Props {
  transacoes: Tx[];
}

const RECEITA_GROUPS = ['Receita Não Operacional', 'Receita Operacional'];
const DESPESA_GROUPS = ['Despesa Fixa', 'Despesa Variável', 'Investimento'];

function isReceita(t: Tx) { return t.item && RECEITA_GROUPS.includes(t.item.grupo_principal); }
function isDespesa(t: Tx) { return t.item && DESPESA_GROUPS.includes(t.item.grupo_principal); }

function formatDataCurta(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function diasAte(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(y, (m || 1) - 1, d || 1);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export const AcompanhamentoSection = memo(function AcompanhamentoSection({ transacoes }: Props) {
  const hojeStr = new Date().toISOString().slice(0, 10);

  const proximosVencimentos = useMemo(() => {
    return transacoes
      .filter(t => t.status !== 'Pago' && t.status !== 'Cancelado' && t.dataVencimento >= hojeStr)
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .slice(0, 6);
  }, [transacoes, hojeStr]);

  const pendencias = useMemo(() => {
    return transacoes
      .filter(t => t.status !== 'Pago' && t.status !== 'Cancelado' && t.dataVencimento < hojeStr)
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .slice(0, 6);
  }, [transacoes, hojeStr]);

  const totalPendente = pendencias.reduce((s, t) => s + t.valor, 0);

  return (
    <section aria-labelledby="secao-acompanhamento" className="space-y-4">
      <header>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
          Acompanhamento
        </div>
        <h2 id="secao-acompanhamento" className="mt-1 text-lg font-serif tracking-tight text-foreground">
          O que precisa da sua atenção
        </h2>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agenda Financeira */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 transition-all duration-200 hover:border-border hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--accent-gold-soft))' }}>
                <Calendar className="h-[16px] w-[16px]" style={{ color: 'hsl(var(--accent-gold))' }} />
              </div>
              <h3 className="text-sm font-medium text-foreground">Agenda Financeira</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">Próximos vencimentos</span>
          </div>

          {proximosVencimentos.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhum vencimento no período.</div>
          ) : (
            <ul className="divide-y divide-border/40">
              {proximosVencimentos.map(t => {
                const dias = diasAte(t.dataVencimento);
                const receita = isReceita(t);
                return (
                  <li key={t.id} className="py-3 flex items-center gap-4">
                    <div className="w-14 text-xs uppercase text-muted-foreground tabular-nums">
                      {formatDataCurta(t.dataVencimento)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">
                        {t.observacoes || t.item?.nome || 'Lançamento'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `em ${dias} dias`}
                      </div>
                    </div>
                    <div className={`text-sm font-medium tabular-nums ${receita ? 'text-success' : 'text-foreground'}`}>
                      {receita ? '+' : '−'} {formatCurrency(t.valor)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Pendências */}
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-medium text-foreground">Pendências</h3>
            </div>
            {totalPendente > 0 && (
              <span className="text-xs text-warning tabular-nums">
                {formatCurrency(totalPendente)} em atraso
              </span>
            )}
          </div>

          {pendencias.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Sem pendências vencidas. ✓</div>
          ) : (
            <ul className="divide-y divide-border/40">
              {pendencias.map(t => {
                const dias = Math.abs(diasAte(t.dataVencimento));
                const receita = isReceita(t);
                return (
                  <li key={t.id} className="py-3 flex items-center gap-4">
                    <div className="w-14 text-xs uppercase text-warning tabular-nums">
                      {formatDataCurta(t.dataVencimento)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">
                        {t.observacoes || t.item?.nome || 'Lançamento'}
                      </div>
                      <div className="text-xs text-warning">
                        {dias === 1 ? 'vence há 1 dia' : `vence há ${dias} dias`}
                      </div>
                    </div>
                    <div className={`text-sm font-medium tabular-nums ${receita ? 'text-success' : 'text-destructive'}`}>
                      {receita ? '+' : '−'} {formatCurrency(t.valor)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
});

export default AcompanhamentoSection;
