import { formatDateForStorage } from "@/utils/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import type { PanelFormState } from "../types";
import type { Appointment } from "@/modules/agenda/presentation";

interface BuildPayloadParams {
  state: PanelFormState;
  resolved: { clienteId: string; nome: string };
  isEdit: boolean;
  appointment?: Appointment | null;
  pacotes: any[];
  valorPacote: number;
  cliente?: { telefone?: string; email?: string };
  newClient: { nome: string; telefone: string };
}

export const buildSessionPayload = ({
  state,
  resolved,
  isEdit,
  appointment,
  pacotes,
  valorPacote,
  cliente,
  newClient,
}: BuildPayloadParams) => {
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

export const ensureSessionStub = async ({
  sessionId,
  appointmentId,
  clienteId,
  date,
  time,
  packageCategoryName,
  selectedPackage,
  description,
  valorPacote,
  paidAmount,
}: {
  sessionId: string;
  appointmentId: string | undefined;
  clienteId: string;
  date: Date;
  time: string;
  packageCategoryName: string;
  selectedPackage: any;
  description: string;
  valorPacote: number;
  paidAmount: number;
}): Promise<boolean> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    if (appointmentId) {
      const { data: existingByAppt } = await supabase
        .from("clientes_sessoes")
        .select("id")
        .eq("appointment_id", appointmentId)
        .eq("user_id", user.id)
        .limit(1);

      if (existingByAppt && existingByAppt.length > 0) return true;
    }

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
        descricao: description || "",
        status: null,
        valor_total: valorPacote || paidAmount || 0,
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
