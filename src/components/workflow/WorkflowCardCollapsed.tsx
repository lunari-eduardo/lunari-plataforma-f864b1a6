import React, { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkflowPackageCombobox } from "./WorkflowPackageCombobox";
import { ColoredStatusBadge } from "./ColoredStatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, ChevronDown, ChevronUp, Package, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatToDayMonth } from "@/utils/dateUtils";
import { useAccessControl } from "@/hooks/useAccessControl";
import { buildGalleryNewUrl, buildGalleryDeliverUrl } from "@/utils/galleryRedirect";
import { useSessionGalerias } from "@/hooks/useSessionGalerias";
import { useAppContext } from "@/contexts/AppContext";
import { useSessionFinancialsWithExtras } from "@/features/workflow/hooks/useSessionFinancialsWithExtras";
import { toast } from "sonner";
import type { SessionData } from "@/types/workflow";
import type { DeleteAction } from "./WorkflowDeleteConfirmModal";
import { CardGalleryButtons } from "./details/CardGalleryButtons";
import { CardCollapsedModals } from "./details/CardCollapsedModals";
import { ProductStatusChip } from "./details/ProductStatusChip";
import { SessionCreditBadge } from "@/components/finance/SessionCreditBadge";
import { useSessionCreditContext } from "@/hooks/useSessionCreditContext";

interface WorkflowCardCollapsedProps {
  session: SessionData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  statusOptions: string[];
  packageOptions: any[];
  productOptions: any[];
  onStatusChange: (id: string, newStatus: string) => void;
  onFieldUpdate: (id: string, field: string, value: any, silent?: boolean) => void;
  onDeleteSession?: (id: string, sessionTitle: string, paymentCount: number, action: DeleteAction) => void;
  /** Estado de "Gerenciar Produtos" hoisted em WorkflowCard, compartilhado com o expandido. */
  modalAberto: boolean;
  setModalAberto: (v: boolean) => void;
}

export function WorkflowCardCollapsed({
  session,
  isExpanded,
  onToggleExpand,
  statusOptions,
  packageOptions,
  productOptions,
  onStatusChange,
  onFieldUpdate,
  onDeleteSession,
  modalAberto,
  setModalAberto,
}: WorkflowCardCollapsedProps) {
  const { addPayment, pacotes } = useAppContext();
  const { hasGaleryAccess, accessState } = useAccessControl();
  const { galerias, hasGalerias } = useSessionGalerias(session.sessionId || session.id);

  const [paymentInput, setPaymentInput] = useState("");
  const [workflowPaymentsOpen, setWorkflowPaymentsOpen] = useState(false);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(session.descricao || "");

  useEffect(() => {
    setDescriptionValue(session.descricao || "");
  }, [session.descricao]);

  const formatCurrency = useCallback((value: any) => {
    return `R$ ${(Number(value) || 0).toFixed(2).replace(".", ",")}`;
  }, []);

  // F5.2: pendente com sinal preservado (valores negativos = crédito/overpay).
  const parseSignedMoney = (val: unknown): number => {
    if (typeof val === "number") return val;
    const str = String(val ?? "0");
    const isNeg = /-/.test(str);
    const cleaned = str.replace(/[^\d,]/g, "").replace(",", ".");
    const n = parseFloat(cleaned) || 0;
    return isNeg ? -n : n;
  };

  // Fonte única (RPC workflow_session_financials): mesma usada pelo card
  // expandido e pelo modal de pagamento. Evita divergência entre "topo"
  // e "expandido" ao reabrir a galeria e adicionar nova seleção.
  const fin = useSessionFinancialsWithExtras(
    session.id || null,
    session.galeriaId || null,
    session.sessionId || null,
  );
  const hasGaleria = fin.hasGaleria;

  const calculateRestante = useCallback(() => {
    const total = parseSignedMoney(session.total);
    const pago = parseSignedMoney(session.valorPago);
    if (hasGaleria && fin.totalVisual > 0) {
      return fin.pendenteTot;
    }
    if (total || pago) return total - pago;
    return parseSignedMoney(session.restante);
  }, [
    session.restante,
    session.total,
    session.valorPago,
    hasGaleria,
    fin.totalVisual,
    fin.pendenteTot,
  ]);

  const paymentSubmittingRef = useRef(false);
  const handlePaymentAdd = useCallback(async () => {
    if (paymentSubmittingRef.current) return;
    const raw = paymentInput.trim();
    const value = parseFloat(raw.replace(",", "."));
    if (!raw || isNaN(value) || value <= 0) return;

    paymentSubmittingRef.current = true;
    setPaymentInput("");
    try {
      await addPayment(session.id, value);
    } catch (error) {
      setPaymentInput(raw);
      console.error("❌ Erro ao adicionar pagamento:", error);
    } finally {
      paymentSubmittingRef.current = false;
    }
  }, [paymentInput, addPayment, session.id]);

  const handlePaymentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (paymentSubmittingRef.current) return;
        handlePaymentAdd();
      }
    },
    [handlePaymentAdd],
  );

  const handleDescriptionBlur = useCallback(() => {
    if (descriptionValue !== session.descricao) {
      onFieldUpdate(session.id, "descricao", descriptionValue);
    }
  }, [descriptionValue, session.descricao, session.id, onFieldUpdate]);

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      const statusValue = newStatus === "__CLEAR__" ? "" : newStatus;
      onStatusChange(session.id, statusValue);
    },
    [session.id, onStatusChange],
  );

  const pendente = calculateRestante();
  const hasProdutos = !!(session.produtosList && session.produtosList.length > 0);

  // pacote vazio (limpo) ignora regras_congeladas.
  // Resolução: regras congeladas > lookup local em `pacotes` (caso o otimista
  // ainda não tenha o snapshot completo) > valor cru salvo na sessão.
  const pacoteAtual = (session.pacote ?? "").toString();
  const displayPackageName =
    pacoteAtual === ""
      ? ""
      : session.regras_congeladas?.pacote?.nome ||
        (pacotes || []).find((p: any) => p.id === pacoteAtual || p.nome === pacoteAtual)?.nome ||
        pacoteAtual;

  const handleCreateSelecao = useCallback(() => {
    if (!hasGaleryAccess) {
      setGalleryModalOpen(true);
      return;
    }
    if (galerias.some((g) => g.tipo === "selecao")) {
      toast.error("Esta sessão já possui uma Galeria de Seleção");
      return;
    }

    const parseValor = (str?: string) =>
      Number(String(str || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;

    // Fallback ao registro real do pacote (via id congelado ou nome), caso
    // regras_congeladas esteja incompleto/NULL (ex.: sessões antigas ou
    // freezing que falhou no createSessionFromAppointment).
    const frozenPkg = session.regras_congeladas?.pacote as any | undefined;
    const pacoteAtualRegistro = (pacotes || []).find((p: any) => {
      if (frozenPkg?.id && p.id === frozenPkg.id) return true;
      if (session.pacote && p.nome === session.pacote) return true;
      return false;
    });

    const valorAtualSessao = parseValor(session.valorFotoExtra);
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

    if (!frozenPkg && pacoteAtualRegistro) {
      console.warn(
        "[Workflow→Gallery] regras_congeladas ausente — usando registro atual do pacote como fallback",
        { sessionId: session.id, pacoteId: pacoteAtualRegistro.id },
      );
    }

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
  }, [session, hasGaleryAccess, accessState.planCode, galerias, pacotes]);

  const handleCreateEntrega = useCallback(() => {
    if (!hasGaleryAccess) {
      setGalleryModalOpen(true);
      return;
    }
    if (galerias.some((g) => g.tipo === "entrega" || g.tipo === "transfer")) {
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
  }, [session, hasGaleryAccess, galerias]);

  const temSelecao = galerias.some((g) => g.tipo === "selecao");
  const temEntrega = galerias.some((g) => g.tipo === "entrega" || g.tipo === "transfer");
  const temTodas = temSelecao && temEntrega;

  return (
    <>
      <div className="px-3 py-3 md:px-5 md:py-4 cursor-pointer min-h-[56px]" onClick={onToggleExpand}>
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 md:overflow-visible">


/**
 * Célula "Pendente / Crédito" do card colapsado.
 * - Fonte única: `useSessionCreditContext` decide se a sessão gerou crédito.
 * - Se a sessão gerou crédito ainda disponível ou já consumido → renderiza SessionCreditBadge.
 * - Caso contrário → mostra valor pendente (ou "Quitada").
 */
function CollapsedPendingCell({
  sessionId,
  clienteId,
  pendente,
  formatCurrency,
}: {
  sessionId: string | null;
  clienteId: string | null;
  pendente: number;
  formatCurrency: (v: any) => string;
}) {
  const { data: ctx } = useSessionCreditContext(sessionId);
  const generated = ctx?.generatedBySession ?? 0;
  const showBadge = generated > 0 && clienteId;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide text-right">
        {showBadge ? "Crédito" : "Pendente"}
      </span>
      <div className="min-h-8 flex items-center justify-end">
        {showBadge ? (
          <SessionCreditBadge
            clienteId={clienteId as string}
            sessionId={sessionId}
            sessionPendente={Math.max(0, pendente)}
          />
        ) : (
          <span
            className={`text-sm font-bold tabular-nums text-right ${
              pendente > 0.001 ? "text-destructive" : "text-green-600"
            }`}
          >
            {formatCurrency(Math.max(0, pendente))}
          </span>
        )}
      </div>
    </div>
  );
}

