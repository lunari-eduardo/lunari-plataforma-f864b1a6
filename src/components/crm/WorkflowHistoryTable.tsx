import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { History, Calendar, DollarSign, Package, FileText } from "lucide-react";
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { ClienteCompleto } from '@/types/cliente-supabase';
import { SessionPaymentHistory } from './SessionPaymentHistory';
import { useClientSessionsRealtime } from '@/hooks/useClientSessionsRealtime';
import { useWorkflowRealtime } from '@/features/workflow';
import { SECTION_TITLE } from '@/lib/dialogTokens';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface WorkflowHistoryTableProps {
  cliente: ClienteCompleto;
}

/** Badge de status neutro (Silent Luxury) — sem cores cruas. */
function StatusChip({ status }: { status: string }) {
  const isHistorico = status === 'historico';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
        isHistorico
          ? 'border-border/20 bg-transparent text-muted-foreground'
          : 'border-border/20 bg-muted/40 text-foreground'
      )}
    >
      {isHistorico ? 'Apenas histórico' : status.replace('_', ' ')}
    </span>
  );
}

export function WorkflowHistoryTable({ cliente }: WorkflowHistoryTableProps) {
  const { sessions, loading } = useClientSessionsRealtime(cliente.id);
  const { updateSession } = useWorkflowRealtime();

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">Nenhum histórico encontrado.</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Este cliente ainda não possui trabalhos registrados no workflow.
        </p>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      {sessions.map((item) => (
        <AccordionItem
          key={item.id}
          value={item.id}
          className="border-b border-border/20 last:border-b-0 data-[state=open]:bg-muted/20 rounded-md transition-colors"
        >
          <AccordionTrigger className="px-2 py-2.5 hover:no-underline hover:bg-muted/30 rounded-md">
            <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:gap-4">
              {/* Data + status */}
              <div className="flex items-center gap-2 md:w-[210px] md:shrink-0">
                <Calendar className="h-3.5 w-3.5 text-accent-gold" />
                <span className="text-xs font-medium text-foreground tabular-nums">
                  {formatDateForDisplay(item.data)}
                </span>
                {item.status && <StatusChip status={item.status} />}
              </div>

              {/* Pacote */}
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-xs font-medium text-foreground md:text-[13px]">
                  {item.pacote || 'Pacote não especificado'}
                </div>
                {(item.categoria || item.descricao) && (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {[item.categoria, item.descricao].filter(Boolean).join(' • ')}
                  </div>
                )}
              </div>

              {/* Métricas essenciais */}
              <div className="flex items-center gap-5 md:shrink-0 md:justify-end">
                <div className="flex flex-col items-start md:items-end">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {formatCurrency(item.total || 0)}
                  </span>
                </div>
                <div className="flex flex-col items-start md:items-end">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Pendente</span>
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      (item.restante || 0) > 0 ? 'text-accent-gold' : 'text-muted-foreground'
                    )}
                  >
                    {formatCurrency(item.restante || 0)}
                  </span>
                </div>
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="px-2 pb-5">
            <div className="space-y-4">
              <SessionPaymentHistory
                sessionData={item}
                onPaymentUpdate={async (sessionId, totalPaid, fullPaymentsArray) => {
                  try {
                    await updateSession(
                      sessionId,
                      { valorPago: totalPaid, pagamentos: fullPaymentsArray },
                      true
                    );
                  } catch (error) {
                    console.error('Erro ao atualizar pagamento:', error);
                  }
                }}
              />

              {/* Composição do valor */}
              <div className="border-t border-border/20 pt-3">
                <h4 className={SECTION_TITLE}>
                  <DollarSign className="h-3.5 w-3.5 text-accent-gold" />
                  Composição do valor
                </h4>
                <dl className="mt-2 space-y-1.5">
                  {[
                    ['Base do pacote', item.valorPacote || 0],
                    ['Fotos extras', item.valorTotalFotoExtra || 0],
                    ['Produtos', item.valorTotalProduto || 0],
                    ['Adicional', item.valorAdicional || 0],
                  ].map(([label, valor]) => (
                    <div key={label as string} className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-xs font-medium tabular-nums text-foreground">
                        {formatCurrency(valor as number)}
                      </dd>
                    </div>
                  ))}
                  {item.desconto > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground">Desconto</dt>
                      <dd className="text-xs font-medium tabular-nums text-destructive">
                        -{formatCurrency(item.desconto || 0)}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border/20 pt-2">
                    <dt className="text-xs font-semibold text-foreground">Total</dt>
                    <dd className="text-xs font-semibold tabular-nums text-foreground">
                      {formatCurrency(item.total || 0)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Produtos */}
              {item.produtosList && item.produtosList.length > 0 && (
                <div className="border-t border-border/20 pt-3">
                  <h4 className={SECTION_TITLE}>
                    <Package className="h-3.5 w-3.5 text-accent-gold" />
                    Produtos incluídos
                  </h4>
                  <div className="mt-2 space-y-1.5">
                    {item.produtosList.map((p: any, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {p.nome}
                          {p.quantidade > 1 && ` · ${p.quantidade}x`}
                        </span>
                        <span className="text-xs font-medium tabular-nums text-foreground">
                          {p.tipo === 'manual'
                            ? formatCurrency(p.valorUnitario * p.quantidade)
                            : formatCurrency(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observações */}
              {item.detalhes && (
                <div className="border-t border-border/20 pt-3">
                  <h4 className={SECTION_TITLE}>
                    <FileText className="h-3.5 w-3.5 text-accent-gold" />
                    Observações
                  </h4>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.detalhes}</p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
