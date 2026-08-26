import { useState, Fragment } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  QrCode,
  Link2,
  XCircle,
  ChevronDown,
  Image as ImageIcon,
  Receipt,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  CreditCard,
  Hash,
  FileText,
  Clock,
} from 'lucide-react';
import { Cobranca } from '@/types/cobranca';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { toast } from 'sonner';
import { buildPaymentShareUrl } from '@/utils/domainUtils';
import { cn } from '@/lib/utils';

interface ChargeHistoryProps {
  cobrancas: Cobranca[];
  onCancel: (id: string) => void;
  onView?: (cobranca: Cobranca) => void;
}

/**
 * Renderização segura de tipo/status/badge — aceita valores legados
 * (`foto_extra`, `venda_galeria`, `card`, `pago_manual`, `manual`, ...)
 */
function getTipoView(tipo: string | undefined) {
  switch (tipo) {
    case 'pix':
      return { icon: <QrCode className="h-4 w-4" />, label: 'Pix' };
    case 'link':
      return { icon: <Link2 className="h-4 w-4" />, label: 'Link de Pagamento' };
    case 'foto_extra':
      return { icon: <ImageIcon className="h-4 w-4" />, label: 'Foto extra' };
    case 'venda_galeria':
      return { icon: <ImageIcon className="h-4 w-4" />, label: 'Venda galeria' };
    case 'card':
    case 'cartao':
      return { icon: <Receipt className="h-4 w-4" />, label: 'Cartão' };
    default:
      return { icon: <Receipt className="h-4 w-4" />, label: tipo || '—' };
  }
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

function getStatusView(status: string | undefined): {
  variant: BadgeVariant;
  label: string;
  className?: string;
} {
  switch (status) {
    case 'pendente':
      return { variant: 'secondary', label: 'Aguardando pagamento' };
    case 'parcialmente_pago':
      return {
        variant: 'secondary',
        label: 'Parcialmente pago',
        className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      };
    case 'pago':
      return {
        variant: 'default',
        label: 'Pago',
        className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      };
    case 'pago_manual':
      return {
        variant: 'default',
        label: 'Pago manual',
        className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      };
    case 'cancelado':
      return { variant: 'outline', label: 'Cancelado', className: 'text-muted-foreground' };
    case 'expirado':
      return { variant: 'destructive', label: 'Expirado' };
    default:
      return { variant: 'outline', label: status || '—' };
  }
}

function getProviderLabel(provedor: string | undefined): string {
  switch (provedor) {
    case 'asaas':
      return 'Asaas';
    case 'mercadopago':
      return 'Mercado Pago';
    case 'infinitepay':
      return 'InfinitePay';
    case 'pix_manual':
      return 'PIX Manual';
    default:
      return provedor || '—';
  }
}

export function ChargeHistory({ cobrancas, onCancel, onView }: ChargeHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copiado para a área de transferência!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleExpand = (cobranca: Cobranca) => {
    const isCurrentlyExpanded = expandedId === cobranca.id;
    const next = isCurrentlyExpanded ? null : cobranca.id;
    setExpandedId(next);
    if (!isCurrentlyExpanded && onView) {
      onView(cobranca);
    }
  };

  if (cobrancas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border border-dashed border-border/60 rounded-xl">
        <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">Nenhuma cobrança registrada</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">As cobranças geradas aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <Table className="w-full table-fixed text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border/60">
            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2 w-[72px]">
              Data
            </TableHead>
            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2 w-[80px]">
              Valor
            </TableHead>
            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2">
              Forma
            </TableHead>
            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2">
              Status
            </TableHead>
            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2 text-right w-[64px]">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cobrancas.map((cobranca) => {
            const isExpanded = expandedId === cobranca.id;
            const statusConfig = getStatusView(cobranca.status);
            const tipoConfig = getTipoView(cobranca.tipoCobranca);
            const paymentLink = cobranca.id
              ? buildPaymentShareUrl(cobranca.id)
              : cobranca.ipCheckoutUrl || cobranca.mpPaymentLink || null;

            return (
              <Fragment key={cobranca.id}>
                <TableRow
                  onClick={() => toggleExpand(cobranca)}
                  className={cn(
                    "group transition-colors cursor-pointer select-none",
                    isExpanded ? "bg-muted/40 border-b-0" : "hover:bg-muted/30"
                  )}
                >
                  <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap px-2 py-2.5">
                    {formatDateForDisplay(cobranca.createdAt)}
                  </TableCell>
                  <TableCell className="px-2 py-2.5">
                    <div className="truncate">
                      <span className="font-semibold text-xs text-foreground block truncate">
                        {formatCurrency(cobranca.valor)}
                      </span>
                      {cobranca.valorLiquido != null && cobranca.valorLiquido < cobranca.valor && (
                        <p className="text-[9px] text-muted-foreground truncate">
                          Liq: {formatCurrency(cobranca.valorLiquido)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-2.5">
                    <div className="flex items-center gap-1 text-muted-foreground truncate min-w-0">
                      <span className="shrink-0">{tipoConfig.icon}</span>
                      <span className="text-[11px] font-medium truncate">{tipoConfig.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-2.5">
                    <Badge variant={statusConfig.variant} className={`text-[9px] font-medium px-1.5 py-0.5 truncate max-w-full inline-block ${statusConfig.className || ''}`}>
                      {statusConfig.label}
                      {cobranca.status === 'parcialmente_pago' && cobranca.totalParcelas && cobranca.totalParcelas > 1
                        ? ` (${cobranca.parcelasPagas || 0}/${cobranca.totalParcelas})`
                        : cobranca.status === 'pago' && cobranca.totalParcelas && cobranca.totalParcelas > 1
                        ? ` (${cobranca.parcelasPagas || cobranca.totalParcelas}/${cobranca.totalParcelas})`
                        : ''}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-2 py-2.5">
                    <div className="flex justify-end items-center gap-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(cobranca);
                        }}
                        className={cn(
                          "h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors shrink-0",
                          isExpanded && "bg-muted text-foreground"
                        )}
                        title={isExpanded ? "Recolher detalhes" : "Expandir detalhes da cobrança"}
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform duration-200",
                            isExpanded && "rotate-180 text-primary"
                          )}
                        />
                      </Button>
                      {cobranca.status === 'pendente' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancel(cobranca.id);
                          }}
                          className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-md shrink-0"
                          title="Cancelar cobrança"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>

                {/* Linha expansível com detalhes inline 100% responsivos */}
                {isExpanded && (
                  <TableRow className="bg-muted/40 hover:bg-muted/40 border-t-0">
                    <TableCell colSpan={5} className="p-2 pt-0 pb-3">
                      <div className="p-3 rounded-xl bg-background border border-border/60 space-y-3 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200 w-full min-w-0">
                        {/* Card Resumo com Valor e Status */}
                        <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                Valor Total
                              </span>
                              <span className="text-lg font-bold text-foreground">
                                {formatCurrency(cobranca.valor)}
                              </span>
                            </div>
                            <Badge
                              variant={statusConfig.variant}
                              className={`text-[10px] font-semibold px-2 py-0.5 ${statusConfig.className || ''}`}
                            >
                              {statusConfig.label}
                            </Badge>
                          </div>

                          {/* Discriminação de Taxa e Líquido se aplicável */}
                          {cobranca.valorLiquido != null && cobranca.valorLiquido < cobranca.valor && (
                            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">
                                Taxas: -{formatCurrency(cobranca.valor - cobranca.valorLiquido)}
                              </span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                Líquido: {formatCurrency(cobranca.valorLiquido)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Informações detalhadas em Grid 2x2 */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-muted/20 border border-border/40 space-y-0.5 min-w-0">
                            <span className="text-muted-foreground flex items-center gap-1 text-[9px] font-medium">
                              <Calendar className="h-3 w-3 shrink-0" /> Criada em
                            </span>
                            <p className="font-semibold text-foreground text-[11px] truncate">
                              {formatDateForDisplay(cobranca.createdAt)}
                            </p>
                          </div>

                          <div className="p-2 rounded-lg bg-muted/20 border border-border/40 space-y-0.5 min-w-0">
                            <span className="text-muted-foreground flex items-center gap-1 text-[9px] font-medium">
                              <CreditCard className="h-3 w-3 shrink-0" /> Gateway
                            </span>
                            <p className="font-semibold text-foreground text-[11px] truncate">
                              {getProviderLabel(cobranca.provedor)}
                            </p>
                          </div>

                          <div className="p-2 rounded-lg bg-muted/20 border border-border/40 space-y-0.5 min-w-0">
                            <span className="text-muted-foreground flex items-center gap-1 text-[9px] font-medium">
                              <Clock className="h-3 w-3 shrink-0" /> Forma
                            </span>
                            <p className="font-semibold text-foreground text-[11px] truncate">
                              {tipoConfig.label}
                            </p>
                          </div>

                          <div className="p-2 rounded-lg bg-muted/20 border border-border/40 space-y-0.5 min-w-0">
                            <span className="text-muted-foreground flex items-center gap-1 text-[9px] font-medium">
                              <Receipt className="h-3 w-3 shrink-0" /> Parcelamento
                            </span>
                            <p className="font-semibold text-foreground text-[11px] truncate">
                              {cobranca.totalParcelas && cobranca.totalParcelas > 1
                                ? `${cobranca.parcelasPagas || (cobranca.status === 'pago' ? cobranca.totalParcelas : 0)} de ${cobranca.totalParcelas}x`
                                : 'À vista'}
                            </p>
                          </div>
                        </div>

                        {/* Descrição se houver */}
                        {cobranca.descricao && (
                          <div className="p-2 rounded-lg bg-muted/20 border border-border/40 space-y-0.5 min-w-0">
                            <span className="text-muted-foreground flex items-center gap-1 text-[9px] font-medium">
                              <FileText className="h-3 w-3 shrink-0" /> Descrição
                            </span>
                            <p className="text-[11px] text-foreground break-words">{cobranca.descricao}</p>
                          </div>
                        )}

                        {/* ID de Transação */}
                        {(cobranca.mpPaymentId || cobranca.id) && (
                          <div className="p-2 rounded-lg bg-muted/20 border border-border/40 flex items-center justify-between text-xs min-w-0 gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground shrink-0 text-[9px] font-medium">ID:</span>
                              <span className="font-mono text-[10px] truncate text-foreground min-w-0">
                                {cobranca.mpPaymentId || cobranca.id}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] shrink-0 rounded-md"
                              onClick={() => handleCopy(cobranca.mpPaymentId || cobranca.id, `id-${cobranca.id}`, 'ID da cobrança')}
                            >
                              {copiedKey === `id-${cobranca.id}` ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        )}

                        {/* Se houver Link de Pagamento */}
                        {paymentLink && (
                          <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 space-y-2 min-w-0">
                            <span className="text-[9px] font-bold text-primary uppercase tracking-wider block">
                              Link de Pagamento
                            </span>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                              <div className="flex-1 min-w-0 bg-background/80 px-2 py-1.5 rounded-lg border border-border/60 text-[10px] font-mono truncate text-muted-foreground">
                                {paymentLink}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px] gap-1 rounded-md flex-1 sm:flex-initial"
                                  onClick={() => handleCopy(paymentLink, `link-${cobranca.id}`, 'Link de pagamento')}
                                >
                                  {copiedKey === `link-${cobranca.id}` ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                  Copiar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 px-2 text-[11px] gap-1 rounded-md flex-1 sm:flex-initial"
                                  asChild
                                >
                                  <a href={paymentLink} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-3 w-3" />
                                    Abrir
                                  </a>
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Se houver Código Pix Copia e Cola */}
                        {cobranca.mpPixCopiaCola && (
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-2 min-w-0">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                              Pix Copia e Cola
                            </span>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                              <div className="flex-1 min-w-0 bg-background/80 px-2 py-1.5 rounded-lg border border-border/60 text-[10px] font-mono truncate text-muted-foreground">
                                {cobranca.mpPixCopiaCola}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] gap-1 rounded-md shrink-0 w-full sm:w-auto"
                                onClick={() => handleCopy(cobranca.mpPixCopiaCola!, `pix-${cobranca.id}`, 'Código Pix')}
                              >
                                {copiedKey === `pix-${cobranca.id}` ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                                Copiar Pix
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
