import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  formatDateForInput,
  safeParseInputDate,
} from "@/utils/dateUtils";
import { buildPaymentShareUrl } from "@/utils/domainUtils";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { useClientesRealtime } from "@/hooks/useClientesRealtime";
import { useAgendaConflict } from "@/hooks/useAgendaConflict";
import { useAppointmentWorkflowInfo } from "@/hooks/useAppointmentWorkflowInfo";
import { useCobranca } from "@/hooks/useCobranca";
import { useNumberInput } from "@/hooks/useNumberInput";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { extractAgendaErrorMessage } from "@/utils/agendaSlotGuard";
import type { Appointment, AppointmentStatus } from "@/modules/agenda/presentation";
import { PanelFormState, STATUS_META } from "../types";
import { buildSessionPayload, ensureSessionStub } from "./sessionPanelUtils";

interface UseSessionPanelFormParams {
  open: boolean;
  appointment?: Appointment | null;
  initialDate?: Date;
  initialTime?: string;
  preselectedClienteId?: string;
  onSave: (data: any) => any | Promise<any>;
  onPersist?: (data: any) => void | Promise<void>;
}

export function useSessionPanelForm({
  open,
  appointment = null,
  initialDate,
  initialTime,
  preselectedClienteId,
  onSave,
  onPersist,
}: UseSessionPanelFormParams) {
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
  }, [appointment, initialDate, initialTime, preselectedClienteId, clientes]);

  const [form, setForm] = useState<PanelFormState>(buildInitialState);
  const [dateInput, setDateInput] = useState(() =>
    formatDateForInput(form.date),
  );
  const [timeInput, setTimeInput] = useState(form.time);

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
  }, [open, appointment?.id, buildInitialState]);

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
    () =>
      pagoCobrancas.reduce(
        (acc, c) =>
          acc +
          (c.valor_principal != null
            ? Number(c.valor_principal)
            : Number(c.valor) || 0),
        0,
      ),
    [pagoCobrancas],
  );

  const isConfirmedWithDeposit = useMemo(
    () =>
      isEdit &&
      form.status === "confirmado" &&
      (pagoCobrancas.length > 0 || (workflowInfo.totalPaid ?? 0) > 0),
    [isEdit, form.status, pagoCobrancas.length, workflowInfo.totalPaid],
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

          const payload = buildSessionPayload({
            state: next,
            resolved,
            isEdit,
            appointment,
            pacotes,
            valorPacote,
            cliente,
            newClient,
          });

          const createdApp = await onSave(payload);

          if (!isEdit && cobrarAoSalvar && resolved.clienteId) {
            const createdSessionId =
              createdApp?.sessionId || createdApp?.session_id;
            const createdAppId = createdApp?.id;

            if (!createdSessionId || !createdAppId) {
              toast.error(
                "Não foi possível preparar a cobrança. Abra a sessão e tente novamente.",
              );
              return;
            }

            const ok = await ensureSessionStub({
              sessionId: createdSessionId,
              appointmentId: createdAppId,
              clienteId: resolved.clienteId,
              date: parsedDate,
              time: finalTime,
              packageCategoryName,
              selectedPackage,
              description: form.description,
              valorPacote,
              paidAmount: form.paidAmount,
            });

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

    if (appointment?.sessionId) {
      const ok = await ensureSessionStub({
        sessionId: appointment.sessionId,
        appointmentId: appointment.id,
        clienteId: form.clienteId,
        date: form.date,
        time: form.time,
        packageCategoryName,
        selectedPackage,
        description: form.description,
        valorPacote,
        paidAmount: form.paidAmount,
      });

      if (!ok) {
        toast.error("Erro ao preparar cobrança. Tente novamente.");
        return;
      }

      if (onPersist) {
        try {
          const payload = buildSessionPayload({
            state: form,
            resolved: {
              clienteId: form.clienteId,
              nome: clientDisplayName,
            },
            isEdit,
            appointment,
            pacotes,
            valorPacote,
            cliente,
            newClient,
          });
          await onPersist(payload);
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

  return {
    isEdit,
    pacotes,
    categorias,
    clientes,
    dialogProps,
    workflowInfo,
    showClientEdit,
    setShowClientEdit,
    showDelete,
    setShowDelete,
    showCharge,
    setShowCharge,
    showBriefing,
    setShowBriefing,
    showSchedule,
    setShowSchedule,
    newClientMode,
    setNewClientMode,
    newClient,
    setNewClient,
    saving,
    cobrarAoSalvar,
    chargeSessionId,
    showHistory,
    setShowHistory,
    form,
    setForm,
    dateInput,
    setDateInput,
    timeInput,
    setTimeInput,
    selectedPackage,
    valorPacote,
    packageCategoryName,
    cliente,
    clientDisplayName,
    handleCobrarAoSalvarChange,
    paidInput,
    cobrancas,
    confirmDialogState,
    handleConfirmDialog,
    handleCancelDialog,
    handleCloseDialog,
    handleCancelCharge,
    pagoCobrancas,
    pendenteCobrancas,
    totalPagoCobrancas,
    isConfirmedWithDeposit,
    cobrancaPendente,
    cobrancaPendenteLink,
    cobranca,
    cobrancaLink,
    handlePackageSelect,
    commitDate,
    commitTime,
    handleSave,
    handleGerarCobranca,
    statusMeta,
    contextLine,
    overlayOpen,
  };
}
