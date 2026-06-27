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
import { toast } from "sonner";
import type { SessionData } from "@/types/workflow";
import type { DeleteAction } from "./WorkflowDeleteConfirmModal";
import { CardGalleryButtons } from "./details/CardGalleryButtons";
import { CardCollapsedModals } from "./details/CardCollapsedModals";

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
}: WorkflowCardCollapsedProps) {
  const { addPayment } = useAppContext();
  const { hasGaleryAccess, accessState } = useAccessControl();
  const { galerias, hasGalerias } = useSessionGalerias(session.sessionId || session.id);

  const [paymentInput, setPaymentInput] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
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

  // F5.2: session.restante já calculado em convertSessionToData (DB triggers).
  const calculateRestante = useCallback(() => {
    const restanteStr = typeof session.restante === "string" ? session.restante : String(session.restante || "0");
    return parseFloat(restanteStr.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
  }, [session.restante]);

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
  const hasProdutos = session.produtosList && session.produtosList.length > 0;
  const produtosProduzidos = hasProdutos ? session.produtosList!.filter((p) => p.produzido) : [];
  const todosCompletos = hasProdutos && produtosProduzidos.length === session.produtosList!.length;
  const parcialmenteCompletos =
    hasProdutos && produtosProduzidos.length > 0 && produtosProduzidos.length < session.produtosList!.length;

  // pacote vazio (limpo) ignora regras_congeladas
  const pacoteAtual = (session.pacote ?? "").toString();
  const displayPackageName =
    pacoteAtual === "" ? "" : session.regras_congeladas?.pacote?.nome || pacoteAtual;

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
    const valorAtualSessao = parseValor(session.valorFotoExtra);
    const valorCongelado = Number(session.regras_congeladas?.pacote?.valorFotoExtra) || 0;
    const precoExtraAtual = valorAtualSessao > 0 ? valorAtualSessao : valorCongelado;

    const url = buildGalleryNewUrl({
      sessionId: session.sessionId || session.id,
      sessionUuid: session.id,
      clienteId: session.clienteId,
      clienteNome: session.nome,
      clienteEmail: session.email || "",
      clienteTelefone: session.whatsapp || "",
      pacoteNome: session.regras_congeladas?.pacote?.nome || session.pacote,
      pacoteCategoria: session.regras_congeladas?.pacote?.categoria || session.categoria,
      fotosIncluidas: session.regras_congeladas?.pacote?.fotosIncluidas,
      modeloCobranca: session.regras_congeladas?.precificacaoFotoExtra?.modelo,
      precoExtra: precoExtraAtual,
      tipoAssinatura: accessState.planCode,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }, [session, hasGaleryAccess, accessState.planCode, galerias]);

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
    <div className="px-3 py-3 md:px-5 md:py-4 cursor-pointer min-h-[56px]" onClick={onToggleExpand}>
      <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 md:overflow-visible">
        <div
          className={cn(
            "grid items-center gap-x-5 gap-y-2 min-w-[1180px] md:min-w-0",
            "grid-cols-[28px_46px_minmax(140px,1.2fr)_minmax(160px,1.4fr)_minmax(210px,1.9fr)_minmax(120px,1fr)_96px_88px_minmax(110px,1fr)_minmax(140px,1.2fr)_28px]",
          )}
        >
          {/* 1: Expand */}
          <div className="h-8 w-8 flex items-center justify-center shrink-0 hover:bg-primary/10 rounded">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-primary" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* 2: Data */}
          <div className="text-sm font-medium text-foreground tabular-nums min-h-8 flex items-center">
            {formatToDayMonth(session.data)}
          </div>

          {/* 3: Nome + WhatsApp */}
          <div className="flex items-center gap-1.5 min-w-0 min-h-8" onClick={(e) => e.stopPropagation()}>
            {session.clienteId ? (
              <Link
                to={`/app/clientes/${session.clienteId}`}
                className="text-sm font-medium text-primary hover:text-primary/80 hover:underline break-words leading-tight"
              >
                {session.nome}
              </Link>
            ) : (
              <span className="text-sm font-medium text-foreground break-words leading-tight">
                {session.nome}
              </span>
            )}
            {session.whatsapp && (
              <a
                href={`https://wa.me/${session.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <MessageCircle className="h-3.5 w-3.5 text-green-600 hover:text-green-700" />
              </a>
            )}
          </div>

          {/* 4: Descrição */}
          <div className="flex flex-col gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Descrição</span>
            <Input
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Descrição..."
              className={cn(
                "text-[11px] border border-border/40 rounded-md bg-transparent focus:bg-card/60 dark:focus:bg-card/10 transition-colors",
                isExpanded
                  ? "min-h-8 h-auto whitespace-normal break-words py-1 px-2"
                  : "h-8 truncate",
              )}
            />
          </div>

          {/* 5: Pacote */}
          <div className="flex flex-col gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Pacote</span>
            <WorkflowPackageCombobox
              key={`package-${session.id}-${pacoteAtual}`}
              value={pacoteAtual}
              displayName={displayPackageName}
              onValueChange={(packageData) => {
                if (!packageData.id && !packageData.nome) {
                  onFieldUpdate(session.id, "pacote", "");
                  return;
                }
                onFieldUpdate(session.id, "pacote", packageData.id || packageData.nome);
              }}
            />
          </div>

          {/* 6: Status */}
          <div className="flex flex-col gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</span>
            <Select value={session.status || ""} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-8 text-xs border-0 bg-transparent p-0 focus:ring-0 [&>svg]:hidden justify-center">
                <SelectValue placeholder="Status">
                  {session.status ? (
                    <ColoredStatusBadge status={session.status} showBackground={true} />
                  ) : (
                    <span className="text-muted-foreground italic text-xs">Sem status</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-50">
                <SelectItem value="__CLEAR__" className="text-muted-foreground italic">
                  Limpar status
                </SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    <ColoredStatusBadge status={status} showBackground={true} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 7: Fotos extras (read-only) */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide text-center whitespace-nowrap">
              Fotos extras
            </span>
            <div className="min-h-8 flex items-center justify-center">
              <span className="text-sm font-medium text-foreground tabular-nums">
                {session.qtdFotosExtra || 0}
              </span>
            </div>
          </div>

          {/* 8: Produtos */}
          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide text-center">
              Produtos
            </span>
            <div className="min-h-8 flex items-center justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalAberto(true)}
                className="h-8 min-w-[60px] px-3 text-xs border rounded-md bg-background hover:bg-muted"
              >
                <Package
                  className={`h-3.5 w-3.5 mr-1 ${hasProdutos ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="tabular-nums">{hasProdutos ? session.produtosList!.length : 0}</span>
                {todosCompletos && <span className="ml-1 w-2 h-2 bg-green-500 rounded-full" />}
                {parcialmenteCompletos && (
                  <span className="ml-1 w-2 h-2 bg-yellow-500 rounded-full" />
                )}
              </Button>
            </div>
          </div>

          {/* 9: Pendente/Crédito */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide text-right">
              {pendente < 0 ? "Crédito" : "Pendente"}
            </span>
            <div className="min-h-8 flex items-center justify-end">
              <span
                className={`text-sm font-bold tabular-nums text-right ${
                  pendente > 0
                    ? "text-destructive"
                    : pendente < 0
                      ? "text-yellow-500"
                      : "text-green-600"
                }`}
              >
                {pendente < 0
                  ? `+${formatCurrency(Math.abs(pendente))}`
                  : formatCurrency(pendente)}
              </span>
            </div>
          </div>

          {/* 10: Galerias */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Galerias</span>
            <div className="min-h-8 flex items-center">
              <CardGalleryButtons
                galerias={galerias}
                hasGalerias={hasGalerias}
                temSelecao={temSelecao}
                temEntrega={temEntrega}
                temTodas={temTodas}
                onCreateSelecao={handleCreateSelecao}
                onCreateEntrega={handleCreateEntrega}
              />
            </div>
          </div>

          {/* 11: Excluir */}
          <div className="flex items-center justify-center min-h-8" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-destructive/10 transition-all"
              title="Excluir sessão"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        </div>
      </div>

      <CardCollapsedModals
        session={session}
        productOptions={productOptions}
        modalAberto={modalAberto}
        setModalAberto={setModalAberto}
        onFieldUpdate={onFieldUpdate}
        formatCurrency={formatCurrency}
        workflowPaymentsOpen={workflowPaymentsOpen}
        setWorkflowPaymentsOpen={setWorkflowPaymentsOpen}
        pendente={pendente}
        galleryModalOpen={galleryModalOpen}
        setGalleryModalOpen={setGalleryModalOpen}
        deleteModalOpen={deleteModalOpen}
        setDeleteModalOpen={setDeleteModalOpen}
        onDeleteSession={onDeleteSession}
      />
    </div>
  );
}
