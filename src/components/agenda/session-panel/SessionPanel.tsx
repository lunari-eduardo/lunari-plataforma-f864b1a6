/**
 * SessionPanel — painel lateral único de gerenciamento da sessão da Agenda.
 *
 * Substitui `AppointmentForm` (nova sessão) e `AppointmentDetails` (edição).
 * Os três estados — nova, pendente e confirmada — usam exatamente o mesmo
 * layout, a mesma ordem de seções e os mesmos componentes. Apenas o
 * comportamento de alguns blocos muda.
 *
 * Ordem fixa: Cliente → Sessão → Financeiro → Cobrança → Informações → Status.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  CalendarDays,
  Clock,
  CreditCard,
  DollarSign,
  ExternalLink,
  FileText,
  Package,
  Paperclip,
  Send,
  Tag,
  ChevronDown,
  History,
  Trash2,
  User,
  CheckCircle2,
  Copy,
  Ban,
  Plus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  formatDateForInput,
  safeParseInputDate,
  formatDateForStorage,
} from "@/utils/dateUtils";
import { toTitleCase } from "@/hooks/useTitleCase";
import { buildPaymentShareUrl } from "@/utils/domainUtils";

import { PanelSection, PanelField } from "./PanelSection";
import ClientSearchCombobox from "../ClientSearchCombobox";
import PackageSearchCombobox from "../PackageSearchCombobox";
import { CategorySelector } from "@/components/ui/category-selector";
import { ClientEditModal } from "../ClientEditModal";
import { AppointmentDeleteConfirmModal } from "../AppointmentDeleteConfirmModal";
import { SlotConflictDialog } from "../SlotConflictDialog";
import { ChargeModal } from "@/components/cobranca/ChargeModal";
import { SendBriefingModal } from "@/components/formularios/SendBriefingModal";
import { SessionTimeline } from "./SessionTimeline";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

import { useOrcamentos } from "@/hooks/useOrcamentos";
import { useClientesRealtime } from "@/hooks/useClientesRealtime";
import { useAgendaConflict } from "@/hooks/useAgendaConflict";
import { useAppointmentWorkflowInfo } from "@/hooks/useAppointmentWorkflowInfo";
import { useCobranca } from "@/hooks/useCobranca";
import { useNumberInput } from "@/hooks/useNumberInput";
import { supabase } from "@/integrations/supabase/client";
import { extractAgendaErrorMessage } from "@/utils/agendaSlotGuard";
import type {
  Appointment,
  AppointmentStatus,
} from "@/modules/agenda/presentation";

export interface SessionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modo edição quando presente; modo criação quando ausente. */
  appointment?: Appointment | null;
  initialDate?: Date;
  initialTime?: string;
  preselectedClienteId?: string;
  onSave: (data: any) => any | Promise<any>;
  /** Persistência silenciosa (não fecha o painel) antes de gerar cobrança. */
  onPersist?: (data: any) => void | Promise<void>;
  onDelete?: (id: string, action?: "preserve" | "refund" | "remove") => void;
}

interface PanelFormState {
  date: Date;
  time: string;
  clienteId: string;
  clientName: string;
  status: AppointmentStatus;
  description: string;
  packageId: string;
  categoria: string;
  paidAmount: number;
}

const STATUS_META: Record<
  AppointmentStatus,
  { label: string; dot: string; chip: string }
> = {
  "a confirmar": {
    label: "Pendente",
    dot: "bg-lunar-warning",
    chip: "bg-lunar-warning/15 text-lunar-warning border-lunar-warning/30",
  },
  confirmado: {
    label: "Confirmado",
    dot: "bg-lunar-success",
    chip: "bg-lunar-success/15 text-lunar-success border-lunar-success/30",
  },
};

export default function SessionPanel({
  open,
  onOpenChange,
  appointment = null,
  initialDate,
  initialTime,
  preselectedClienteId,
  onSave,
  onPersist,
  onDelete,
}: SessionPanelProps) {
  const isEdit = !!appointment;
  const { pacotes, categorias } = useOrcamentos();
  const { clientes, adicionarCliente } = useClientesRealtime();
  const { guard, dialogProps } = useAgendaConflict();
  const { workflowInfo } = useAppointmentWorkflowInfo(appointment?.id);

  const [showClientEdit, setShowClientEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showCharge, setShowCharge] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newClient, setNewClient] = useState({ nome: "", telefone: "" });
  const [saving, setSaving] = useState(false);
  const [cobrarAoSalvar, setCobrarAoSalvar] = useState(false);
  const [chargeSessionId, setChargeSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const buildInitialState = useCallback((): PanelFormState => {
    if (appointment) {
      const fallbackId =
        appointment.clienteId ||
        clientes.find(
          (c) =>
            c.nome?.trim().toLowerCase() ===
            appointment.title?.trim().toLowerCase(),
        )?.id ||
        "";
      return {
        date: appointment.date,
        time: appointment.time,
        clienteId: fallbackId,
        clientName: appointment.title,
        status: appointment.status,
        description: appointment.description || "",
        packageId: appointment.packageId || "",
        categoria: "",
        paidAmount: appointment.paidAmount || 0,
      };
    }
    const cli = preselectedClienteId
      ? clientes.find((c) => c.id === preselectedClienteId)
      : undefined;
    return {
      date: initialDate || new Date(),
      time: initialTime || "09:00",
      clienteId: preselectedClienteId || "",
      clientName: cli?.nome || "",
      status: "a confirmar",
      description: "",
      packageId: "",
      categoria: "",
      paidAmount: 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment, initialDate, initialTime, preselectedClienteId, clientes]);

  const [form, setForm] = useState<PanelFormState>(buildInitialState);
  const [dateInput, setDateInput] = useState(() =>
    formatDateForInput(form.date),
  );
  const [timeInput, setTimeInput] = useState(form.time);

  // Reidrata sempre que o painel abre (ou muda o agendamento alvo)
  useEffect(() => {
    if (!open) return;
    const next = buildInitialState();
    setForm(next);
    setDateInput(formatDateForInput(next.date));
    setTimeInput(next.time);
    setShowSchedule(false);
    setNewClientMode(false);
    setNewClient({ nome: "", telefone: "" });
    setCobrarAoSalvar(false);
    setChargeSessionId(null);
    setShowHistory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment?.id]);

  const selectedPackage = useMemo(
    () => pacotes.find((p: any) => p.id === form.packageId),
    [pacotes, form.packageId],
  );
  const valorPacote = Number(
    (selectedPackage as any)?.valor ??
      (selectedPackage as any)?.valor_base ??
      (selectedPackage as any)?.valorVenda ??
      0,
  );

  const packageCategoryName = useMemo(() => {
    if (!selectedPackage) return "";
    const pkg = selectedPackage as any;
    if (pkg.categorias?.nome) return pkg.categorias.nome;
    if (typeof pkg.categoria === "string") return pkg.categoria;
    return "";
  }, [selectedPackage]);

  const cliente = useMemo(
    () => clientes.find((c) => c.id === form.clienteId),
    [clientes, form.clienteId],
  );
  const clientDisplayName = cliente?.nome || form.clientName;

  const handleCobrarAoSalvarChange = (checked: boolean) => {
    setCobrarAoSalvar(checked);
    if (checked) {
      setForm((prev) => ({ ...prev, paidAmount: 0 }));
    }
  };

  const paidInput = useNumberInput({
    value: form.paidAmount,
    onChange: (value) => {
      const parsed = parseFloat(value) || 0;
      setForm((prev) => ({ ...prev, paidAmount: parsed }));
      if (parsed > 0 && cobrarAoSalvar) {
        setCobrarAoSalvar(false);
      }
    },
  });

  /* ---------------------------------- Cobrança --------------------------------- */
  const { cobrancas, cancelCharge } = useCobranca({
    sessionId: appointment?.sessionId,
    clienteId: !appointment?.sessionId
      ? form.clienteId || undefined
      : undefined,
  });

  const {
    dialogState: confirmDialogState,
    confirm: confirmDialog,
    handleConfirm: handleConfirmDialog,
    handleCancel: handleCancelDialog,
    handleClose: handleCloseDialog,
  } = useConfirmDialog();

  const handleCancelCharge = async (chargeId: string) => {
    const ok = await confirmDialog({
      title: "Cancelar cobrança pendente",
      description:
        "Deseja realmente cancelar esta cobrança pendente? O link de pagamento deixará de ser válido.",
      confirmText: "Cancelar cobrança",
      cancelText: "Voltar",
      variant: "destructive",
    });
    if (ok) {
      await cancelCharge(chargeId);
    }
  };

  const pagoCobrancas = useMemo(
    () => cobrancas.filter((c) => ["pago", "pago_manual"].includes(c.status)),
    [cobrancas],
  );
  const pendenteCobrancas = useMemo(
    () => cobrancas.filter((c) => c.status === "pendente"),
    [cobrancas],
  );
  const totalPagoCobrancas = useMemo(
    () => pagoCobrancas.reduce((acc, c) => acc + (c.valor_principal != null ? Number(c.valor_principal) : Number(c.valor) || 0), 0),
    [pagoCobrancas],
  );

  const cobrancaPendente = pendenteCobrancas[0] || null;
  const cobrancaPendenteLink = cobrancaPendente
    ? cobrancaPendente.id
      ? buildPaymentShareUrl(cobrancaPendente.id)
      : cobrancaPendente.mpPaymentLink || cobrancaPendente.ipCheckoutUrl || ""
    : "";

  const cobranca =
    pagoCobrancas[0] || pendenteCobrancas[0] || cobrancas[0] || null;
  const cobrancaLink = cobranca
    ? cobranca.id
      ? buildPaymentShareUrl(cobranca.id)
      : cobranca.mpPaymentLink || cobranca.ipCheckoutUrl || ""
    : "";

  /* --------------------------------- Handlers ---------------------------------- */
  const handlePackageSelect = (packageId: string, packageData?: any) => {
    const pkg = packageData || pacotes.find((p: any) => p.id === packageId);
    setForm((prev) => ({
      ...prev,
      packageId,
      clientName: prev.clientName,
      categoria: prev.categoria || (pkg?.categorias?.nome ?? prev.categoria),
    }));
  };

  const commitDate = () => {
    const parsed = safeParseInputDate(dateInput);
    if (parsed) setForm((prev) => ({ ...prev, date: parsed }));
    else setDateInput(formatDateForInput(form.date));
  };

  const commitTime = () => {
    if (!timeInput) {
      setTimeInput(form.time);
      return;
    }
    setForm((prev) => ({ ...prev, time: timeInput }));
  };

  const buildPayload = (
    state: PanelFormState,
    resolved: { clienteId: string; nome: string },
  ) => {
    const pkg = pacotes.find((p: any) => p.id === state.packageId) as any;
    const categoryLabel =
      pkg?.categorias?.nome || pkg?.categoria || state.categoria || "Sessão";
    const duracaoMinutos =
      pkg?.duracao_minutos !== undefined && pkg?.duracao_minutos !== null
        ? Number(pkg.duracao_minutos)
        : isEdit
          ? (appointment?.durationMinutes ?? 0)
          : 0;
    const base = {
      date: isEdit ? formatDateForStorage(state.date) : state.date,
      time: state.time,
      title: resolved.nome,
      client: resolved.nome,
      clienteId: resolved.clienteId,
      type: categoryLabel,
      category: pkg?.nome,
      status: state.status,
      description: state.description,
      packageId: state.packageId,
      paidAmount: state.paidAmount,
      durationMinutes: duracaoMinutos,
    };
    if (isEdit) return { ...base, id: appointment!.id };
    return {
      ...base,
      valorPacote,
      whatsapp: cliente?.telefone || newClient.telefone || "",
      email: cliente?.email || "",
      clientPhone: cliente?.telefone || newClient.telefone || "",
      clientEmail: cliente?.email || "",
    };
  };

  const resolveClient = async (): Promise<{
    clienteId: string;
    nome: string;
  } | null> => {
    if (form.clienteId) {
      return { clienteId: form.clienteId, nome: clientDisplayName };
    }
    if (newClientMode && newClient.nome.trim()) {
      const criado = await adicionarCliente({
        nome: newClient.nome.trim(),
        telefone: newClient.telefone || "",
        email: "",
      });
      return { clienteId: criado.id, nome: newClient.nome.trim() };
    }
    if (isEdit) {
      return { clienteId: "", nome: form.clientName };
    }
    toast.error("Selecione um cliente do CRM.");
    return null;
  };

  /**
   * Garante que exista uma linha em `clientes_sessoes` para o agendamento antes de
   * qualquer cobrança — evita transações órfãs quando o pagamento é confirmado.
   * Idempotente.
   */
  const ensureSessionStub = async (
    sessionId: string,
    appointmentId: string | undefined,
    clienteId: string,
    date: Date,
    time: string,
  ): Promise<boolean> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      // 1. Verificar primeiro por appointment_id se disponível (evita duplicar sessão criada pelo WorkflowSupabaseService)
      if (appointmentId) {
        const { data: existingByAppt } = await supabase
          .from("clientes_sessoes")
          .select("id")
          .eq("appointment_id", appointmentId)
          .eq("user_id", user.id)
          .limit(1);

        if (existingByAppt && existingByAppt.length > 0) return true;
      }

      // 2. Verificar por session_id
      const { data: existingBySession } = await supabase
        .from("clientes_sessoes")
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .limit(1);

      if (existingBySession && existingBySession.length > 0) return true;

      const { error: insertErr } = await supabase
        .from("clientes_sessoes")
        .insert({
          user_id: user.id,
          cliente_id: clienteId,
          session_id: sessionId,
          appointment_id: appointmentId ?? null,
          data_sessao: formatDateForStorage(date),
          hora_sessao: time,
          categoria: packageCategoryName || "Sessão",
          pacote: (selectedPackage as any)?.nome || null,
          descricao: form.description || "",
          // Mesmo status usado na criação oficial da sessão (WorkflowSupabaseService)
          status: "stub",
          valor_total: valorPacote || form.paidAmount || 0,
          valor_base_pacote: valorPacote || 0,
          valor_pago: 0,
          detalhes: { stub_cobranca: true } as any,
          tipo_registro: "workflow",
        });
      if (insertErr) return false;
      return true;
    } catch {
      return false;
    }
  };

  // Realtime subscription para auto-atualizar status do appointment no painel aberto
  useEffect(() => {
    if (!open || !appointment?.id) return;

    const channel = supabase
      .channel(`session-panel-appointment-${appointment.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `id=eq.${appointment.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status as AppointmentStatus;
          if (
            newStatus &&
            (newStatus === "confirmado" || newStatus === "a confirmar")
          ) {
            setForm((prev) => {
              if (prev.status !== newStatus) {
                return { ...prev, status: newStatus };
              }
              return prev;
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, appointment?.id]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const parsedDate = safeParseInputDate(dateInput) ?? form.date;
      const finalTime = timeInput || form.time;
      const resolved = await resolveClient();
      if (!resolved) return;

      // Blindagem: Se for edição, checar se o status no banco já virou 'confirmado' (via webhook de pagamento)
      let effectiveStatus = form.status;
      if (isEdit && appointment?.id && effectiveStatus !== "confirmado") {
        const { data: currentDb } = await supabase
          .from("appointments")
          .select("status")
          .eq("id", appointment.id)
          .maybeSingle();
        if (currentDb?.status === "confirmado") {
          effectiveStatus = "confirmado";
          setForm((prev) => ({ ...prev, status: "confirmado" }));
        }
      }

      await guard({
        date: parsedDate,
        time: finalTime,
        status: effectiveStatus,
        ignoreAppointmentId: appointment?.id,
        silentOnPending: effectiveStatus !== "confirmado",
        exec: async () => {
          const next = {
            ...form,
            status: effectiveStatus,
            date: parsedDate,
            time: finalTime,
            clienteId: resolved.clienteId,
            clientName: resolved.nome,
          };
          setForm(next);
          const createdApp = await onSave(buildPayload(next, resolved));

          // Fluxo "Cobrar ao salvar": abre o modal de cobrança logo após criar
          if (!isEdit && cobrarAoSalvar && resolved.clienteId) {
            const createdSessionId = createdApp?.sessionId || createdApp?.session_id;
            const createdAppId = createdApp?.id;

            if (!createdSessionId || !createdAppId) {
              toast.error(
                "Não foi possível preparar a cobrança. Abra a sessão e tente novamente.",
              );
              return;
            }
            const ok = await ensureSessionStub(
              createdSessionId,
              createdAppId,
              resolved.clienteId,
              parsedDate,
              finalTime,
            );
            if (!ok) {
              toast.error(
                "Erro ao preparar cobrança. Abra a sessão e tente novamente.",
              );
              return;
            }
            setChargeSessionId(createdSessionId);
            setShowCharge(true);
          }
        },
      });
    } catch (err) {
      toast.error(extractAgendaErrorMessage(err));
    } finally {
      setTimeout(() => setSaving(false), 400);
    }
  };

  const handleGerarCobranca = async () => {
    if (!form.clienteId) {
      toast.error("Vincule um cliente do CRM para gerar cobrança.");
      return;
    }
    if (valorPacote <= 0 && form.paidAmount <= 0) {
      toast.error(
        "Selecione um pacote ou informe uma entrada antes de cobrar.",
      );
      return;
    }

    // Garantir vínculo da sessão antes da cobrança (idempotente)
    if (appointment?.sessionId) {
      const ok = await ensureSessionStub(
        appointment.sessionId,
        appointment.id,
        form.clienteId,
        form.date,
        form.time,
      );
      if (!ok) {
        toast.error("Erro ao preparar cobrança. Tente novamente.");
        return;
      }

      if (onPersist) {
        try {
          await onPersist(
            buildPayload(form, {
              clienteId: form.clienteId,
              nome: clientDisplayName,
            }),
          );
        } catch (err) {
          toast.error(extractAgendaErrorMessage(err));
          return;
        }
      }
    }

    setShowCharge(true);
  };

  const statusMeta = STATUS_META[form.status];
  const contextLine = [
    format(form.date, "dd MMM", { locale: ptBR }),
    form.time,
    packageCategoryName || form.categoria,
    (selectedPackage as any)?.nome ||
      (form.packageId ? undefined : "Sem pacote"),
  ].filter(Boolean) as string[];

  const overlayOpen =
    showCharge || showBriefing || showClientEdit || showDelete;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            "w-full sm:max-w-[520px] p-0 gap-0 flex flex-col",
            "h-dvh max-h-dvh bg-background backdrop-blur-none",
            overlayOpen && "opacity-40 blur-[2px] pointer-events-none",
          )}
        >
          {/* ============================ CABEÇALHO FIXO ============================ */}
          <header className="shrink-0 border-b border-border/60 px-4 pt-4 pb-3 pr-12">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {isEdit ? "Sessão" : "Nova sessão"}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                  statusMeta.chip,
                )}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)}
                />
                {statusMeta.label}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowSchedule((v) => !v)}
              className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {contextLine.map((part, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-border">•</span>}
                  {part}
                </span>
              ))}
              <CalendarDays className="h-3.5 w-3.5 ml-1 opacity-70" />
            </button>

            {showSchedule && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <PanelField label="Data" htmlFor="sp-date">
                  <Input
                    id="sp-date"
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    onBlur={commitDate}
                    className="h-10 rounded-lg text-base sm:text-sm"
                  />
                </PanelField>
                <PanelField label="Horário" htmlFor="sp-time">
                  <Input
                    id="sp-time"
                    type="time"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    onBlur={commitTime}
                    className="h-10 rounded-lg text-base sm:text-sm"
                  />
                </PanelField>
              </div>
            )}
          </header>

          {/* =========================== CONTEÚDO ROLÁVEL =========================== */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* -------------------------------- CLIENTE -------------------------------- */}
            <PanelSection icon={User} title="Cliente">
              {form.clienteId ? (
                <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-lg border border-border/60 bg-muted/20">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-accent-gold/15 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-accent-gold" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {clientDisplayName}
                        </span>
                        <span className="shrink-0 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          CRM
                        </span>
                      </div>
                      {cliente?.telefone && (
                        <span className="text-xs text-muted-foreground block truncate">
                          {cliente.telefone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          clienteId: "",
                          clientName: "",
                        }))
                      }
                      title="Trocar cliente"
                    >
                      Trocar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs rounded-md"
                      onClick={() => setShowClientEdit(true)}
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              ) : newClientMode ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <UserPlus className="h-3.5 w-3.5 text-accent-gold" />
                      Cadastrar novo cliente
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNewClientMode(false);
                        setNewClient({ nome: "", telefone: "" });
                      }}
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Buscar no CRM
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      value={newClient.nome}
                      onChange={(e) =>
                        setNewClient((p) => ({
                          ...p,
                          nome: toTitleCase(e.target.value),
                        }))
                      }
                      placeholder="Nome do cliente *"
                      className="h-10 rounded-lg text-base sm:text-sm"
                      autoFocus
                    />
                    <Input
                      value={newClient.telefone}
                      onChange={(e) =>
                        setNewClient((p) => ({
                          ...p,
                          telefone: e.target.value,
                        }))
                      }
                      placeholder="WhatsApp / Telefone"
                      className="h-10 rounded-lg text-base sm:text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <ClientSearchCombobox
                      value={form.clienteId}
                      onSelect={(id) => {
                        const c = clientes.find((x) => x.id === id);
                        setForm((prev) => ({
                          ...prev,
                          clienteId: id,
                          clientName: c?.nome || prev.clientName,
                        }));
                      }}
                      placeholder="Buscar cliente no CRM..."
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNewClientMode(true)}
                    className="h-10 px-3 rounded-lg shrink-0 gap-1.5 border-border/80 hover:border-accent-gold/60 hover:bg-accent-gold/10 text-xs font-medium text-foreground transition-all shadow-xs"
                    title="Cadastrar novo cliente"
                  >
                    <Plus className="h-4 w-4 text-accent-gold" />
                    <span>Novo</span>
                  </Button>
                </div>
              )}
            </PanelSection>

            {/* -------------------------------- SESSÃO --------------------------------- */}
            <PanelSection icon={Calendar} title="Sessão">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PanelField label="Categoria">
                  <CategorySelector
                    categorias={categorias as unknown as string[]}
                    value={form.categoria}
                    onValueChange={(categoria) =>
                      setForm((prev) => ({ ...prev, categoria, packageId: "" }))
                    }
                    placeholder="Filtrar pacotes..."
                  />
                </PanelField>

                <PanelField label="Pacote">
                  <PackageSearchCombobox
                    value={form.packageId}
                    onSelect={handlePackageSelect}
                    placeholder="Selecionar pacote..."
                    filtrarPorCategoria={form.categoria}
                    hidePrice
                  />
                </PanelField>
              </div>
            </PanelSection>

            {/* ------------------------------ FINANCEIRO UNIFICADO ------------------------------- */}
            <PanelSection
              icon={DollarSign}
              title="Financeiro"
              action={
                isEdit && form.clienteId ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                    onClick={handleGerarCobranca}
                  >
                    <Plus className="h-3 w-3" />
                    {cobranca ? "Nova cobrança" : "Gerar cobrança"}
                  </Button>
                ) : undefined
              }
            >
              <div className="space-y-4">
                {/* 1. Registro de entrada manual */}
                <div className="space-y-2">
                  <label
                    htmlFor="sp-entrada"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Registro de entrada manual
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                      R$
                    </span>
                    <Input
                      id="sp-entrada"
                      type="number"
                      min="0"
                      step="0.01"
                      value={cobrarAoSalvar ? "" : paidInput.displayValue}
                      onChange={paidInput.handleChange}
                      onFocus={paidInput.handleFocus}
                      placeholder={
                        cobrarAoSalvar
                          ? "Desativado (cobrança via link ativa)"
                          : "0,00"
                      }
                      disabled={cobrarAoSalvar || (isEdit && (!!appointment?.paidAmount && appointment.paidAmount > 0 || workflowInfo?.hasPayments))}
                      className={cn(
                        "h-10 rounded-lg pl-10 text-base sm:text-sm transition-opacity",
                        (cobrarAoSalvar || (isEdit && (!!appointment?.paidAmount && appointment.paidAmount > 0 || workflowInfo?.hasPayments))) &&
                          "opacity-50 cursor-not-allowed bg-muted/30",
                      )}
                    />
                  </div>
                  {cobrarAoSalvar && (
                    <p className="text-[11px] text-muted-foreground">
                      Entrada manual desativada pois{" "}
                      <strong className="font-medium text-foreground">
                        "Cobrança via link"
                      </strong>{" "}
                      está ativa.
                    </p>
                  )}
                </div>

                {/* Divisor */}
                <div className="border-t border-border/60 my-1" />

                {/* 2. Cobrança via link */}
                <div>
                  {!isEdit ? (
                    <div className="space-y-2.5">
                      <label
                        htmlFor="sp-cobrar-ao-salvar"
                        className={cn(
                          "flex items-start justify-between gap-3",
                          form.paidAmount > 0
                            ? "opacity-60 cursor-not-allowed"
                            : "cursor-pointer",
                        )}
                      >
                        <div className="min-w-0 space-y-1">
                          <span className="block text-xs font-semibold text-foreground">
                            Cobrança via link
                          </span>
                          <span className="block text-[11px] text-muted-foreground leading-relaxed">
                            Ao criar o agendamento pendente, abre link de
                            cobrança e você configura o valor.
                          </span>
                          <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            A sessão é confirmada automaticamente no pagamento.
                          </span>
                        </div>
                        <Switch
                          id="sp-cobrar-ao-salvar"
                          checked={cobrarAoSalvar}
                          disabled={form.paidAmount > 0}
                          onCheckedChange={handleCobrarAoSalvarChange}
                        />
                      </label>
                      {form.paidAmount > 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          Cobrança via link desativada pois uma{" "}
                          <strong className="font-medium text-foreground">
                            entrada manual (R$ {form.paidAmount.toFixed(2)})
                          </strong>{" "}
                          já foi informada.
                        </p>
                      ) : cobrarAoSalvar ? (
                        <p className="text-[11px] text-muted-foreground">
                          Valor sugerido:{" "}
                          <span className="text-foreground font-medium">
                            R${" "}
                            {(valorPacote > 0
                              ? valorPacote
                              : form.paidAmount || 0
                            ).toFixed(2)}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  ) : !cobranca ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 py-1">
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold text-foreground">
                            Cobrança via link
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            Nenhuma cobrança criada para esta sessão.
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className="h-8 rounded-lg text-xs gap-1.5"
                          onClick={handleGerarCobranca}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Gerar cobrança
                        </Button>
                      </div>
                    </div>
                  ) : pagoCobrancas.length > 0 ? (
                    <div className="space-y-2">
                      <span className="block text-xs font-semibold text-foreground">
                        Cobrança via link
                      </span>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>Pago</span>
                            <span className="text-muted-foreground font-normal">
                              • R$ {totalPagoCobrancas.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                            {pagoCobrancas[0].provedor === "pix_manual"
                              ? "PIX Manual"
                              : pagoCobrancas[0].provedor}
                            {pagoCobrancas.length > 1 &&
                              ` (${pagoCobrancas.length} pagamentos)`}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs rounded-md"
                          onClick={handleGerarCobranca}
                        >
                          Histórico
                        </Button>
                      </div>

                      {/* Se houver cobrança pendente adicional (ex: extras ou novo link), exibir alerta e ações */}
                      {cobrancaPendente && cobrancaPendenteLink && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span className="text-xs font-medium text-amber-500">
                                Cobrança adicional pendente
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-foreground">
                              R$ {cobrancaPendente.valor.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 rounded text-[11px] px-2 gap-1"
                              onClick={() =>
                                window.open(
                                  cobrancaPendenteLink,
                                  "_blank",
                                  "noopener",
                                )
                              }
                            >
                              <ExternalLink className="h-3 w-3" />
                              Abrir link
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 rounded text-[11px] px-2 gap-1"
                              onClick={() => {
                                navigator.clipboard?.writeText(
                                  cobrancaPendenteLink,
                                );
                                toast.success("Link de checkout copiado!");
                              }}
                            >
                              <Copy className="h-3 w-3" />
                              Copiar link
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 rounded text-[11px] px-2 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                              onClick={() => handleCancelCharge(cobrancaPendente.id)}
                            >
                              <Ban className="h-3 w-3" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : ["cancelado", "expirado", "estornado"].includes(
                      cobranca.status,
                    ) && pendenteCobrancas.length === 0 ? (
                    <div className="space-y-1.5">
                      <span className="block text-xs font-semibold text-foreground">
                        Cobrança via link
                      </span>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-muted-foreground capitalize">
                            Cobrança {cobranca.status} (R${" "}
                            {cobranca.valor.toFixed(2)})
                          </span>
                          <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                            Gere uma nova cobrança para enviar ao cliente.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="h-8 rounded-lg text-xs gap-1.5 shrink-0"
                          onClick={handleGerarCobranca}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Nova cobrança
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="block text-xs font-semibold text-foreground">
                        Cobrança via link
                      </span>
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Aguardando pagamento
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {(cobrancaPendente || cobranca)?.provedor ===
                              "pix_manual"
                                ? "PIX Manual"
                                : (cobrancaPendente || cobranca)?.provedor}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            R${" "}
                            {(cobrancaPendente || cobranca)?.valor.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                          {(cobrancaPendenteLink || cobrancaLink) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 rounded-md text-xs gap-1.5"
                              onClick={() =>
                                window.open(
                                  cobrancaPendenteLink || cobrancaLink,
                                  "_blank",
                                  "noopener",
                                )
                              }
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Abrir link
                            </Button>
                          )}
                          {(cobrancaPendenteLink || cobrancaLink) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 rounded-md text-xs gap-1.5"
                              onClick={() => {
                                navigator.clipboard?.writeText(
                                  cobrancaPendenteLink || cobrancaLink,
                                );
                                toast.success("Link de checkout copiado!");
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copiar link
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-md text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                            onClick={() =>
                              handleCancelCharge(
                                (cobrancaPendente || cobranca)!.id,
                              )
                            }
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Cancelar cobrança
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </PanelSection>

            {/* ------------------------------ DESCRIÇÃO -------------------------------- */}
            <PanelSection icon={FileText} title="Descrição">
              <PanelField label="Descrição" htmlFor="sp-desc">
                <Textarea
                  id="sp-desc"
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Descrição da sessão..."
                  className="min-h-[72px] rounded-lg text-base sm:text-sm resize-none"
                />
              </PanelField>
              {isEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  onClick={() => {
                    if (!form.clienteId) {
                      toast.error(
                        "Vincule um cliente do CRM para enviar o briefing.",
                      );
                      return;
                    }
                    setShowBriefing(true);
                  }}
                >
                  <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                  Briefing
                </Button>
              )}
            </PanelSection>

            {/* -------------------------------- STATUS --------------------------------- */}
            {form.status !== "confirmado" || !isEdit ? (
              <PanelSection icon={Tag} title="Status da sessão">
                <div className="grid grid-cols-2 gap-2">
                  {(["a confirmar", "confirmado"] as AppointmentStatus[]).map(
                    (value) => {
                      const meta = STATUS_META[value];
                      const active = form.status === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({ ...prev, status: value }))
                          }
                          className={cn(
                            "flex h-10 items-center justify-center gap-2 rounded-lg border text-sm transition-colors",
                            active
                              ? meta.chip
                              : "border-border/60 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              active ? meta.dot : "bg-muted-foreground/40",
                            )}
                          />
                          {meta.label}
                        </button>
                      );
                    },
                  )}
                </div>
              </PanelSection>
            ) : null}

            {/* ------------------------- HISTÓRICO (colapsável) ------------------------ */}
            {isEdit && appointment?.sessionId && (
              <div className="rounded-xl border border-border/60 bg-card/80">
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-sm font-medium text-foreground"
                  aria-expanded={showHistory}
                >
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4 text-accent-gold" />
                    Histórico da sessão
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      showHistory && "rotate-180",
                    )}
                  />
                </button>
                {showHistory && (
                  <div className="border-t border-border/60 px-3.5 py-3">
                    <SessionTimeline sessionId={appointment.sessionId} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============================= RODAPÉ FIXO ============================== */}
          <footer className="shrink-0 border-t border-border/60 px-4 py-3 pb-safe-plus-2 sm:pb-3 flex items-center justify-between gap-2">
            {isEdit && onDelete ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-lg text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Excluir sessão
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-9 rounded-lg text-xs"
                onClick={handleSave}
                disabled={saving}
              >
                {isEdit ? "Salvar alterações" : "Criar sessão"}
              </Button>
            </div>
          </footer>
        </SheetContent>
      </Sheet>

      {/* ------------------------------- Modais ---------------------------------- */}
      {form.clienteId && (
        <ClientEditModal
          open={showClientEdit}
          onOpenChange={setShowClientEdit}
          clienteId={form.clienteId}
          clienteNome={clientDisplayName}
          onSuccess={(novoNome) => {
            if (novoNome)
              setForm((prev) => ({ ...prev, clientName: novoNome }));
          }}
        />
      )}

      {isEdit && onDelete && (
        <AppointmentDeleteConfirmModal
          isOpen={showDelete}
          onClose={() => setShowDelete(false)}
          onConfirm={(action) => onDelete(appointment!.id, action)}
          appointmentData={{
            id: appointment!.id,
            sessionId: appointment!.sessionId,
            title: appointment!.title,
            clientName: appointment!.client,
            date: format(appointment!.date, "dd/MM/yyyy", { locale: ptBR }),
            hasWorkflowSession: workflowInfo.hasSession,
            hasPayments: workflowInfo.hasPayments,
          }}
        />
      )}

      {showCharge && form.clienteId && (
        <ChargeModal
          isOpen={showCharge}
          onClose={() => {
            setShowCharge(false);
          }}
          clienteId={form.clienteId}
          clienteNome={clientDisplayName}
          clienteWhatsapp={cliente?.telefone}
          sessionId={chargeSessionId || appointment?.sessionId}
          valorSugerido={valorPacote > 0 ? valorPacote : form.paidAmount || 0}
        />
      )}

      {showBriefing && form.clienteId && (
        <SendBriefingModal
          open={showBriefing}
          onOpenChange={setShowBriefing}
          clienteId={form.clienteId}
          clienteNome={clientDisplayName}
          clienteTelefone={cliente?.telefone}
          sessionId={appointment?.sessionId}
        />
      )}

      <SlotConflictDialog {...dialogProps} />

      <ConfirmDialog
        state={confirmDialogState}
        onConfirm={handleConfirmDialog}
        onCancel={handleCancelDialog}
        onClose={handleCloseDialog}
      />
    </>
  );
}
