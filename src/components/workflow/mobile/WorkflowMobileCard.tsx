import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  MessageCircle,
  ExternalLink,
  Camera,
  Package,
  Calendar,
  Tag,
  Percent,
  Image as ImageIcon,
  FileText,
  DollarSign,
  Send,
  Eye,
  Trash2,
  Plus,
  Lock,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { SessionData } from "@/types/workflow";
import type { DeleteAction } from "../WorkflowDeleteConfirmModal";
import { WorkflowDeleteConfirmModal } from "../WorkflowDeleteConfirmModal";
import { WorkflowPaymentsModal } from "../WorkflowPaymentsModal";
import { GerenciarProdutosModal } from "../GerenciarProdutosModal";
import { GalleryUpgradeModal } from "../GalleryUpgradeModal";
import { ManualPaymentModal } from "../ManualPaymentModal";
import { ChargeModal } from "@/components/cobranca/ChargeModal";
import { CombinedChargeModal } from "@/components/cobranca/CombinedChargeModal";
import { QuickPaymentScopeDialog } from "../details/QuickPaymentScopeDialog";
import { OverrideExtrasDialog } from "../details/OverrideExtrasDialog";
import { WorkflowPackageCombobox } from "../WorkflowPackageCombobox";
import { SessionCreditBadge } from "@/components/finance/SessionCreditBadge";
import { FotosExtrasPaymentBadge } from "../FotosExtrasPaymentBadge";
import { useAppContext } from "@/contexts/AppContext";
import { useWorkflowStatus } from "@/hooks/useWorkflowStatus";
import { useGalleryExtraCalc } from "@/hooks/useGalleryExtraCalc";
import { useSessionFinancialsWithExtras } from "@/features/workflow/hooks/useSessionFinancialsWithExtras";
import {
  useMonthAccessControl,
  useMonthGalleriasForSession,
} from "@/features/workflow/presentation/WorkflowMonthDataContext";
import { useQuickPaymentScope } from "../details/useQuickPaymentScope";
import { buildGalleryNewUrl, buildGalleryDeliverUrl } from "@/utils/galleryRedirect";
import { computeProductNextAction } from "@/features/workflow/domain/productNextAction";
import {
  formatCurrencyBRL,
  formatFullDateLong,
  parseMoneyValue,
} from "./workflowMobileUtils";

interface WorkflowMobileCardProps {
  session: SessionData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  statusOptions: string[];
  packageOptions: any[];
  productOptions: any[];
  onStatusChange: (id: string, newStatus: string) => void;
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
  onDeleteSession?: (
    id: string,
    sessionTitle: string,
    paymentCount: number,
    action: DeleteAction,
  ) => void;
}

type MobileTab = "resumo" | "produtos" | "galeria" | "financeiro";

export function WorkflowMobileCard({
  session,
  isExpanded,
  onToggleExpand,
  statusOptions,
  packageOptions,
  productOptions,
  onStatusChange,
  onFieldUpdate,
  onDeleteSession,
}: WorkflowMobileCardProps) {
  const navigate = useNavigate();
  const { addPayment, pacotes } = useAppContext();
  const { getStatusColor } = useWorkflowStatus();
  const { hasGaleryAccess, accessState } = useMonthAccessControl();
  const { galerias, hasGalerias } = useMonthGalleriasForSession(
    session.sessionId || session.id,
  );

  // Tab state do card expandido
  const [activeTab, setActiveTab] = useState<MobileTab>("resumo");

  // Modais
  const [modalProdutosOpen, setModalProdutosOpen] = useState(false);
  const [workflowPaymentsOpen, setWorkflowPaymentsOpen] = useState(false);
  const [galleryUpgradeOpen, setGalleryUpgradeOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showExtraChargeModal, setShowExtraChargeModal] = useState(false);
  const [showCombinedChargeModal, setShowCombinedChargeModal] = useState(false);

  // Campos editáveis
  const [descontoValue, setDescontoValue] = useState(session.desconto || "");
  const [adicionalValue, setAdicionalValue] = useState(session.valorAdicional || "");
  const [valorFotoExtraValue, setValorFotoExtraValue] = useState(
    session.valorFotoExtra || "",
  );
  const [obsValue, setObsValue] = useState(session.observacoes || "");
  const [pendingExtraEdit, setPendingExtraEdit] = useState<{
    field: "valorFotoExtra" | "qtdFotosExtra";
    nextValue: string;
    previousValue: string;
    source: "gallery" | "frozen_rules";
  } | null>(null);

  useEffect(() => {
    setDescontoValue(session.desconto || "");
    setAdicionalValue(session.valorAdicional || "");
    setValorFotoExtraValue(session.valorFotoExtra || "");
    setObsValue(session.observacoes || "");
  }, [session.desconto, session.valorAdicional, session.valorFotoExtra, session.observacoes]);

  // Cálculos financeiros (RPC canonica)
  const { calc: extraCalc, resolvedGalleryId } = useGalleryExtraCalc(
    session.galeriaId || null,
    { sessionId: session.sessionId || null },
  );

  const fin = useSessionFinancialsWithExtras(
    session.id || null,
    session.galeriaId || resolvedGalleryId || null,
    session.sessionId || null,
  );
  const hasGaleria = fin.hasGaleria || Boolean(resolvedGalleryId);

  const pendente = useMemo(() => {
    if (fin.totalVisual > 0 || fin.pagoTotal > 0) {
      return fin.pendenteTot;
    }
    const total = parseMoneyValue(session.total);
    const pago = parseMoneyValue(session.valorPago);
    if (total || pago) return total - pago;
    return parseMoneyValue(session.restante);
  }, [fin.totalVisual, fin.pagoTotal, fin.pendenteTot, session.total, session.valorPago, session.restante]);

  const totalCalculado = useMemo(() => {
    if (fin.totalVisual > 0) return fin.totalVisual;
    return parseMoneyValue(session.total);
  }, [fin.totalVisual, session.total]);

  const valorPagoDisplay = useMemo(() => {
    if (fin.pagoTotal > 0) return fin.pagoTotal;
    return parseMoneyValue(session.valorPago);
  }, [fin.pagoTotal, session.valorPago]);

  const isPago = pendente <= 0.01 && totalCalculado > 0;

  // Cor de status da sessão
  const statusColor = useMemo(() => {
    if (!session.status) return "#9CA3AF";
    return getStatusColor(session.status);
  }, [session.status, getStatusColor]);

  // Pacote display
  const pacoteAtual = (session.pacote ?? "").toString();
  const displayPackageName = useMemo(() => {
    if (!pacoteAtual) return "Sem pacote";
    return (
      session.regras_congeladas?.pacote?.nome ||
      (pacotes || []).find(
        (p: any) => p.id === pacoteAtual || p.nome === pacoteAtual,
      )?.nome ||
      pacoteAtual
    );
  }, [pacoteAtual, session.regras_congeladas, pacotes]);

  // Quantidade de fotos extras
  const qtdFotosExtras = useMemo(() => {
    return fin.qtdExtras > 0
      ? fin.qtdExtras
      : Number(session.qtdFotosExtra) || 0;
  }, [fin.qtdExtras, session.qtdFotosExtra]);

  // Pagamento rápido
  const quickPay = useQuickPaymentScope({
    sessionId: session.id,
    pendente: Math.max(0, pendente),
    hasGaleria,
    valorFotoExtra: parseMoneyValue(session.valorFotoExtra),
    qtdFotosExtraAtual: qtdFotosExtras,
    addPayment,
    onFieldUpdate,
  });

  // Galerias
  const temSelecao = galerias.some((g) => g.tipo === "selecao");
  const temEntrega = galerias.some(
    (g) => g.tipo === "entrega" || g.tipo === "transfer",
  );

  const handleCreateSelecao = useCallback(() => {
    if (!hasGaleryAccess) {
      setGalleryUpgradeOpen(true);
      return;
    }
    if (temSelecao) {
      toast.error("Esta sessão já possui uma Galeria de Seleção");
      return;
    }
    const frozenPkg = session.regras_congeladas?.pacote as any | undefined;
    const pacoteAtualRegistro = (pacotes || []).find((p: any) => {
      if (frozenPkg?.id && p.id === frozenPkg.id) return true;
      if (session.pacote && p.nome === session.pacote) return true;
      return false;
    });

    const valorAtualSessao = parseMoneyValue(session.valorFotoExtra);
    const valorCongelado = Number(frozenPkg?.valorFotoExtra) || 0;
    const valorPacoteAtual = Number(pacoteAtualRegistro?.valor_foto_extra) || 0;
    const precoExtraAtual =
      valorAtualSessao > 0
        ? valorAtualSessao
        : valorCongelado > 0
        ? valorCongelado
        : valorPacoteAtual;

    const fotosIncluidas =
      Number(frozenPkg?.fotosIncluidas) ||
      Number(pacoteAtualRegistro?.fotos_incluidas) ||
      undefined;

    const modeloCobranca =
      session.regras_congeladas?.precificacaoFotoExtra?.modelo || "fixo";

    const url = buildGalleryNewUrl({
      sessionId: session.sessionId || session.id,
      sessionUuid: session.id,
      clienteId: session.clienteId,
      clienteNome: session.nome,
      clienteEmail: session.email || "",
      clienteTelefone: session.whatsapp || "",
      pacoteNome: frozenPkg?.nome || pacoteAtualRegistro?.nome || session.pacote,
      pacoteCategoria:
        frozenPkg?.categoria ||
        pacoteAtualRegistro?.categorias?.nome ||
        session.categoria,
      fotosIncluidas,
      modeloCobranca,
      precoExtra: precoExtraAtual,
      tipoAssinatura: accessState.planCode,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }, [hasGaleryAccess, temSelecao, session, pacotes, accessState.planCode]);

  const handleCreateEntrega = useCallback(() => {
    if (!hasGaleryAccess) {
      setGalleryUpgradeOpen(true);
      return;
    }
    if (temEntrega) {
      toast.error("Esta sessão já possui uma Galeria de Entrega");
      return;
    }
    const url = buildGalleryDeliverUrl({
      sessionId: session.sessionId || session.id,
      sessionUuid: session.id,
      clienteId: session.clienteId,
      clienteNome: session.nome,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }, [hasGaleryAccess, temEntrega, session]);

  // Edição de campos
  const handleDescontoBlur = useCallback(() => {
    const num = parseMoneyValue(descontoValue);
    const formatted = formatCurrencyBRL(num);
    setDescontoValue(formatted);
    onFieldUpdate(session.id, "desconto", formatted);
  }, [descontoValue, session.id, onFieldUpdate]);

  const handleValorFotoExtraBlur = useCallback(() => {
    const num = parseMoneyValue(valorFotoExtraValue);
    const formatted = formatCurrencyBRL(num);
    setValorFotoExtraValue(formatted);
    onFieldUpdate(session.id, "valorFotoExtra", formatted);
  }, [valorFotoExtraValue, session.id, onFieldUpdate]);

  const handleAdicionalBlur = useCallback(() => {
    const num = parseMoneyValue(adicionalValue);
    const formatted = formatCurrencyBRL(num);
    setAdicionalValue(formatted);
    onFieldUpdate(session.id, "valorAdicional", formatted);
  }, [adicionalValue, session.id, onFieldUpdate]);

  const handleObsBlur = useCallback(() => {
    if (obsValue !== session.observacoes) {
      onFieldUpdate(session.id, "observacoes", obsValue);
    }
  }, [obsValue, session.observacoes, session.id, onFieldUpdate]);

  // Produtos vendidos resumo
  const produtosVendidos = (session.produtosList as any[]) || [];
  const totalProdutosVendidos = produtosVendidos.length;
  const valorProdutosTotal = produtosVendidos.reduce(
    (acc, p) => acc + (Number(p.valorTotal) || Number(p.preco) * Number(p.quantidade) || 0),
    0,
  );
  const productActionInfo = computeProductNextAction(produtosVendidos);

  // Extras da galeria (fonte canônica alinhada com WorkflowCardExpanded)
  const fallbackExtrasTotal =
    (Number(session.qtdFotosExtra) || 0) * parseMoneyValue(session.valorFotoExtra);
  const extrasTotalCanonico =
    (fin.extrasLiquido ?? 0) > 0 ? fin.extrasLiquido : fallbackExtrasTotal;
  const extrasPagoCanonico = fin.extrasPago ?? 0;
  const extrasPendente = fin.extrasPend ?? 0;
  const extrasFullyPaid = extrasPendente <= 0.001;

  // Pendente da sessão (fonte canônica alinhada com WorkflowCardExpanded)
  const valorTotalFallback = parseMoneyValue(session.total);
  const pendenteVisual =
    fin.totalVisual > 0 || fin.pagoTotal > 0
      ? fin.pendenteTot
      : Math.max(0, valorTotalFallback - parseMoneyValue(session.valorPago));
  const pendenteSessaoSugerido =
    fin.totalVisual > 0 ? (fin.pendenteSess ?? 0) : pendenteVisual;

  // Gatilho do botão Cobrar
  const handleCobrarClick = useCallback(() => {
    if (extrasPendente > 0.01 && pendenteSessaoSugerido > 0.01) {
      setShowCombinedChargeModal(true);
    } else if (extrasPendente > 0.01 && pendenteSessaoSugerido <= 0.01) {
      setShowExtraChargeModal(true);
    } else {
      setShowChargeModal(true);
    }
  }, [extrasPendente, pendenteSessaoSugerido]);

  return (
    <>
      <div
        data-card-id={session.id}
        className={cn(
          "w-full rounded-2xl transition-all duration-200 overflow-hidden",
          "bg-card/70 dark:bg-card/40 backdrop-blur-xl",
          "border border-border/40 dark:border-white/10",
          "shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)]",
          isExpanded && "ring-1 ring-primary/30 shadow-[0_4px_20px_rgba(0,0,0,0.08)]",
        )}
      >
        {/* PARTE COLAPSADA DO CARD */}
        <div
          onClick={onToggleExpand}
          className="p-3.5 sm:p-4 cursor-pointer active:bg-accent/30 transition-colors select-none"
        >
          {/* Linha 1: Status Dot + Nome + Menu Ações */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: statusColor }}
                title={session.status || "Sem status"}
              />
              {session.clienteId ? (
                <Link
                  to={`/app/clientes/${session.clienteId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-[15px] text-foreground hover:text-primary transition-colors truncate"
                >
                  {session.nome}
                </Link>
              ) : (
                <span className="font-semibold text-[15px] text-foreground truncate">
                  {session.nome}
                </span>
              )}
            </div>

            {/* Ações contextuais */}
            <div
              className="flex items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {session.whatsapp && (
                <a
                  href={`https://wa.me/${session.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors"
                  title="WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {session.clienteId && (
                    <DropdownMenuItem
                      onClick={() => navigate(`/app/clientes/${session.clienteId}`)}
                    >
                      <Eye className="h-4 w-4 mr-2 text-primary" />
                      Ver perfil no CRM
                    </DropdownMenuItem>
                  )}

                  {session.whatsapp && (
                    <DropdownMenuItem
                      onClick={() =>
                        window.open(
                          `https://wa.me/${session.whatsapp?.replace(/\D/g, "")}`,
                          "_blank",
                        )
                      }
                    >
                      <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                      Conversar no WhatsApp
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span
                        className="w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: statusColor }}
                      />
                      Alterar status
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      <DropdownMenuItem
                        onClick={() => onStatusChange(session.id, "")}
                        className="text-muted-foreground italic"
                      >
                        Limpar status
                      </DropdownMenuItem>
                      {statusOptions.map((opt) => (
                        <DropdownMenuItem
                          key={opt}
                          onClick={() => onStatusChange(session.id, opt)}
                        >
                          <span
                            className="w-2 h-2 rounded-full mr-2"
                            style={{ backgroundColor: getStatusColor(opt) }}
                          />
                          {opt}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuItem onClick={() => setModalProdutosOpen(true)}>
                    <Package className="h-4 w-4 mr-2 text-muted-foreground" />
                    Gerenciar produtos
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setWorkflowPaymentsOpen(true)}>
                    <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                    Histórico financeiro
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setDeleteModalOpen(true)}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir sessão
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Linha 2: Pacote / Categoria */}
          <div className="mt-0.5 text-xs text-muted-foreground truncate">
            {displayPackageName}
          </div>

          {/* Linha 3: Badge de Situação + Fotos + Divisor + Valor em Destaque */}
          <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border/20">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Badge de Situação */}
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide",
                  isPago
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20",
                )}
              >
                {isPago ? "Pago" : "Pendente"}
              </span>

              {/* Indicador de fotos extras */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Camera className="h-3.5 w-3.5" />
                <span>
                  {qtdFotosExtras} {qtdFotosExtras === 1 ? "extra" : "extras"}
                </span>
              </div>
            </div>

            {/* Valor em destaque à direita + Chevron sutil */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-bold tabular-nums tracking-tight",
                  isPago
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400",
                )}
              >
                {formatCurrencyBRL(isPago ? totalCalculado : pendente)}
              </span>

              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-180 text-primary",
                )}
              />
            </div>
          </div>
        </div>

        {/* PARTE EXPANDIDA DO CARD */}
        {isExpanded && (
          <div className="border-t border-border/30 bg-muted/10">
            {/* ABAS */}
            <div className="flex items-center border-b border-border/30 px-3 bg-muted/20">
              {(
                [
                  { key: "resumo", label: "Resumo" },
                  { key: "produtos", label: "Produtos" },
                  { key: "galeria", label: "Galeria" },
                  { key: "financeiro", label: "Financeiro" },
                ] as const
              ).map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab(tab.key);
                    }}
                    className={cn(
                      "flex-1 py-2.5 text-xs font-medium text-center transition-colors relative",
                      isActive
                        ? "text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* CONTEÚDO DAS ABAS */}
            <div className="p-4 space-y-4 text-xs">
              {/* ABA RESUMO */}
              {activeTab === "resumo" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Data da sessão
                    </span>
                    <span className="font-medium text-foreground">
                      {formatFullDateLong(session.data)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" />
                      Pacote
                    </span>
                    <div className="max-w-[180px]">
                      <WorkflowPackageCombobox
                        key={`mobile-pkg-${session.id}`}
                        value={pacoteAtual}
                        displayName={displayPackageName}
                        onValueChange={(pkg) => {
                          if (!pkg.id && !pkg.nome) {
                            onFieldUpdate(session.id, "pacote", "");
                            return;
                          }
                          onFieldUpdate(
                            session.id,
                            "pacote",
                            pkg.id || pkg.nome,
                          );
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      Valor base
                    </span>
                    <span className="font-semibold text-primary">
                      {formatCurrencyBRL(session.valorPacote || (session.regras_congeladas?.pacote as any)?.valorBase || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Percent className="h-3.5 w-3.5" />
                      Desconto
                    </span>
                    <Input
                      value={descontoValue}
                      onChange={(e) => setDescontoValue(e.target.value)}
                      onBlur={handleDescontoBlur}
                      placeholder="R$ 0,00"
                      className="h-7 w-24 text-right text-xs bg-background/50"
                    />
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Valor adicional
                    </span>
                    <Input
                      value={adicionalValue}
                      onChange={(e) => setAdicionalValue(e.target.value)}
                      onBlur={handleAdicionalBlur}
                      placeholder="R$ 0,00"
                      className="h-7 w-24 text-right text-xs bg-background/50"
                    />
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Valor foto extra
                    </span>
                    <Input
                      value={valorFotoExtraValue}
                      onChange={(e) => setValorFotoExtraValue(e.target.value)}
                      onBlur={handleValorFotoExtraBlur}
                      placeholder="R$ 0,00"
                      className="h-7 w-24 text-right text-xs bg-background/50"
                    />
                  </div>

                  <div className="pt-2">
                    <span className="text-muted-foreground flex items-center gap-1.5 mb-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Observações
                    </span>
                    <Textarea
                      value={obsValue}
                      onChange={(e) => setObsValue(e.target.value)}
                      onBlur={handleObsBlur}
                      placeholder="Observações da sessão..."
                      className="text-xs bg-background/50 resize-none min-h-[60px]"
                    />
                  </div>
                </div>
              )}

              {/* ABA PRODUTOS */}
              {activeTab === "produtos" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground">
                        {totalProdutosVendidos} {totalProdutosVendidos === 1 ? "produto" : "produtos"}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Total: {formatCurrencyBRL(valorProdutosTotal)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModalProdutosOpen(true)}
                      className="h-7 text-xs gap-1"
                    >
                      <Package className="h-3 w-3" />
                      Gerenciar
                    </Button>
                  </div>

                  {productActionInfo.label && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-xs">
                      <span
                        className={cn("w-2 h-2 rounded-full", productActionInfo.dotClass)}
                      />
                      <span className="text-muted-foreground">Etapa de produção:</span>
                      <span className="font-medium text-foreground">
                        {productActionInfo.label}
                      </span>
                    </div>
                  )}

                  {totalProdutosVendidos === 0 ? (
                    <div className="text-center py-4 text-muted-foreground border border-dashed rounded-lg">
                      Nenhum produto adicionado nesta sessão.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {produtosVendidos.map((prod: any, idx: number) => (
                        <div
                          key={prod.id || idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/30"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">
                              {prod.nome || prod.titulo || "Produto"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Qtd: {prod.quantidade || 1}
                            </p>
                          </div>
                          <span className="font-semibold text-foreground shrink-0 ml-2">
                            {formatCurrencyBRL(
                              Number(prod.valorTotal) ||
                                Number(prod.preco) * (Number(prod.quantidade) || 1) ||
                                0,
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ABA GALERIA */}
              {activeTab === "galeria" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {/* Galeria de Seleção */}
                    <div className="p-3 rounded-lg bg-background/60 border border-border/30 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">Galeria de Seleção</p>
                        <p className="text-[11px] text-muted-foreground">
                          {temSelecao
                            ? "Galeria criada e ativa"
                            : "Nenhuma seleção criada"}
                        </p>
                      </div>
                      {temSelecao ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const g = galerias.find((item) => item.tipo === "selecao");
                            if (g) window.open(`/app/galeria/${g.id}`, "_blank");
                          }}
                          className="h-7 text-xs gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Abrir
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCreateSelecao}
                          className="h-7 text-xs gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Criar
                        </Button>
                      )}
                    </div>

                    {/* Galeria de Entrega */}
                    <div className="p-3 rounded-lg bg-background/60 border border-border/30 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">Galeria de Entrega</p>
                        <p className="text-[11px] text-muted-foreground">
                          {temEntrega
                            ? "Galeria criada e ativa"
                            : "Nenhuma entrega criada"}
                        </p>
                      </div>
                      {temEntrega ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const g = galerias.find(
                              (item) => item.tipo === "entrega" || item.tipo === "transfer",
                            );
                            if (g) window.open(`/app/galeria/${g.id}`, "_blank");
                          }}
                          className="h-7 text-xs gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Abrir
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCreateEntrega}
                          className="h-7 text-xs gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Criar
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Resumo de Extras da Galeria */}
                  <div className="pt-2 border-t border-border/20 space-y-1.5">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Fotos extras selecionadas:</span>
                      <span className="font-semibold text-foreground">
                        {qtdFotosExtras}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total de fotos extras:</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrencyBRL(extrasTotalCanonico)}
                      </span>
                    </div>
                    {extrasPendente > 0 && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                        <span>Pendente extras:</span>
                        <span>{formatCurrencyBRL(extrasPendente)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA FINANCEIRO */}
              {activeTab === "financeiro" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Valor do pacote:</span>
                      <span className="text-foreground">
                        {formatCurrencyBRL(session.valorPacote || 0)}
                      </span>
                    </div>
                    {parseMoneyValue(session.desconto) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Desconto aplicado:</span>
                        <span className="text-emerald-600">
                          - {formatCurrencyBRL(session.desconto)}
                        </span>
                      </div>
                    )}
                    {parseMoneyValue(session.valorAdicional) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Valor adicional:</span>
                        <span className="text-foreground">
                          + {formatCurrencyBRL(session.valorAdicional)}
                        </span>
                      </div>
                    )}
                    {extrasTotalCanonico > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Fotos extras:</span>
                        <span className="text-foreground">
                          + {formatCurrencyBRL(extrasTotalCanonico)}
                        </span>
                      </div>
                    )}
                    {valorProdutosTotal > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Produtos:</span>
                        <span className="text-foreground">
                          + {formatCurrencyBRL(valorProdutosTotal)}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border/30 flex justify-between font-bold text-sm">
                      <span className="text-foreground">Total da sessão:</span>
                      <span className="text-foreground">
                        {formatCurrencyBRL(totalCalculado)}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
                      <span>Valor já pago:</span>
                      <span>{formatCurrencyBRL(valorPagoDisplay)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-amber-600 dark:text-amber-400">
                      <span>Restante / Pendente:</span>
                      <span>{formatCurrencyBRL(pendente)}</span>
                    </div>
                  </div>

                  {/* Crédito da sessão se houver */}
                  {session.clienteId && (
                    <div className="pt-2">
                      <SessionCreditBadge
                        clienteId={session.clienteId}
                        sessionId={session.sessionId || session.id}
                        sessionPendente={pendente}
                      />
                    </div>
                  )}

                  {/* Pagamento rápido */}
                  {pendente > 0.01 && (
                    <div className="p-3 rounded-lg bg-background/70 border border-border/30 space-y-2">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Adicionar pagamento rápido
                      </span>
                      <div className="flex items-center gap-2">
                        <Input
                          value={quickPay.paymentInput}
                          onChange={(e) => quickPay.setPaymentInput(e.target.value)}
                          onKeyDown={quickPay.handlePaymentKeyDown}
                          placeholder={formatCurrencyBRL(pendente)}
                          className="h-8 text-xs flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={quickPay.handlePaymentAdd}
                          className="h-8 text-xs"
                        >
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setWorkflowPaymentsOpen(true)}
                      className="w-full h-8 text-xs gap-1.5"
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                      Histórico financeiro
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* BOTÕES DE AÇÃO FIXOS NO RODAPÉ DO EXPANDIDO */}
            <div className="p-3 bg-card/90 border-t border-border/30 flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1 h-10 text-xs font-medium gap-1.5"
                onClick={() => setShowManualPaymentModal(true)}
              >
                <DollarSign className="h-4 w-4" />
                Registrar pagamento
              </Button>

              <Button
                className="flex-1 h-10 text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleCobrarClick}
              >
                <Send className="h-4 w-4" />
                Cobrar sessão
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* MODAIS CONTROLADOS PELO CARD */}
      {modalProdutosOpen && (
        <GerenciarProdutosModal
          open={modalProdutosOpen}
          onOpenChange={setModalProdutosOpen}
          sessionId={session.id}
          clienteName={session.nome}
          produtos={(session.produtosList as any) || []}
          productOptions={productOptions}
          onSave={async (novosProdutos) => {
            const produtosCorrigidos = novosProdutos.map((p) => ({
              ...p,
              valorUnitario: p.tipo === "incluso" ? 0 : p.valorUnitario,
            }));
            await onFieldUpdate(session.id, "produtosList", produtosCorrigidos);
          }}
        />
      )}

      {workflowPaymentsOpen && (
        <WorkflowPaymentsModal
          isOpen={workflowPaymentsOpen}
          onClose={() => {
            setWorkflowPaymentsOpen(false);
            window.dispatchEvent(
              new CustomEvent("payment-created", {
                detail: {
                  sessionId: session.sessionId ?? null,
                  sessionUuid: session.id,
                  source: "workflow-mobile-card",
                },
              }),
            );
          }}
          sessionData={session}
          valorTotalCalculado={totalCalculado}
          onPaymentUpdate={() => {}}
        />
      )}

      {deleteModalOpen && onDeleteSession && (
        <WorkflowDeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={(action) => {
            onDeleteSession(
              session.id,
              session.nome || "Sessão",
              Array.isArray(session.pagamentos) ? session.pagamentos.length : 0,
              action,
            );
            setDeleteModalOpen(false);
          }}
          sessionTitle={session.nome || "Sessão"}
          paymentCount={
            Array.isArray(session.pagamentos) ? session.pagamentos.length : 0
          }
        />
      )}

      {galleryUpgradeOpen && (
        <GalleryUpgradeModal
          isOpen={galleryUpgradeOpen}
          onClose={() => setGalleryUpgradeOpen(false)}
        />
      )}

      {showManualPaymentModal && (
        <ManualPaymentModal
          isOpen={showManualPaymentModal}
          onClose={() => setShowManualPaymentModal(false)}
          session={session}
          sessaoPendente={Math.max(0, Number(pendenteSessaoSugerido) || 0)}
          extrasPendente={Math.max(0, Number(extrasPendente) || 0)}
          hasGaleria={hasGaleria}
        />
      )}

      {showChargeModal && (
        <ChargeModal
          isOpen={showChargeModal}
          onClose={() => setShowChargeModal(false)}
          clienteId={session.clienteId || ""}
          clienteNome={session.nome || "Cliente"}
          clienteWhatsapp={session.whatsapp}
          sessionId={session.sessionId || session.id}
          valorSugerido={Math.max(0, Number(pendenteSessaoSugerido) || 0)}
        />
      )}

      {showExtraChargeModal && (
        <ChargeModal
          isOpen={showExtraChargeModal}
          onClose={() => setShowExtraChargeModal(false)}
          clienteId={session.clienteId || ""}
          clienteNome={session.nome || "Cliente"}
          clienteWhatsapp={session.whatsapp}
          sessionId={session.sessionId || session.id}
          galeriaId={resolvedGalleryId || null}
          valorSugerido={Math.max(0, Number(extrasPendente) || 0)}
          finalidade="fotos_extras"
          qtdFotos={qtdFotosExtras}
          nomeSessao={session.pacote || session.nome}
        />
      )}

      {showCombinedChargeModal && (
        <CombinedChargeModal
          isOpen={showCombinedChargeModal}
          onClose={() => setShowCombinedChargeModal(false)}
          clienteId={session.clienteId || ""}
          clienteNome={session.nome || "Cliente"}
          clienteWhatsapp={session.whatsapp}
          sessionId={session.sessionId || session.id}
          galeriaId={resolvedGalleryId ?? null}
          valorSessaoComponente={Math.max(0, Number(pendenteSessaoSugerido) || 0)}
          valorExtrasComponente={Math.max(0, Number(extrasPendente) || 0)}
          qtdFotosExtras={qtdFotosExtras}
          snapshotFotosIncluidas={extraCalc?.included_count ?? null}
          nomeSessao={session.pacote || session.nome}
        />
      )}

      <QuickPaymentScopeDialog
        open={quickPay.scopeOpen}
        excedente={quickPay.excedente}
        valorFotoExtra={parseMoneyValue(session.valorFotoExtra)}
        onCancel={quickPay.cancelScope}
        onScopeSessao={quickPay.chooseSessao}
        onScopeExtras={quickPay.chooseExtras}
      />

      <OverrideExtrasDialog
        pendingExtraEdit={pendingExtraEdit}
        onConfirm={() => {
          if (pendingExtraEdit) {
            onFieldUpdate(
              session.id,
              pendingExtraEdit.field,
              pendingExtraEdit.nextValue,
            );
            setPendingExtraEdit(null);
          }
        }}
        onCancel={() => setPendingExtraEdit(null)}
      />
    </>
  );
}
