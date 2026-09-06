import { supabase } from "@/integrations/supabase/client";
import { generateUniversalSessionId } from "@/types/appointments-supabase";
import { formatDateForStorage } from "@/utils/dateUtils";
import { hydrateStubSession } from "./stubHydrationService";

export { hydrateStubSession };

// Lock para prevenir race conditions na criação de sessões
const creationLocks: Map<string, Promise<any>> = new Map();

/**
 * Método interno para criação de sessão com lock
 */
async function _createSessionInternal(
  appointmentId: string,
  appointmentData: any,
) {
  try {
    console.log(
      "🔄 Creating workflow session from appointment:",
      appointmentId,
      appointmentData,
    );

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("User not authenticated");

    const { data: existingSessions } = await supabase
      .from("clientes_sessoes")
      .select("*")
      .eq("user_id", user.user.id)
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: false })
      .limit(1);

    const existingSession = existingSessions?.[0] || null;

    if (existingSession) {
      const hydrated = await hydrateStubSession(
        existingSession,
        appointmentId,
        user.user.id,
      );

      const { data: freshAppts } = await supabase
        .from("appointments")
        .select("description, paid_amount, cliente_id, date")
        .eq("id", appointmentId)
        .eq("user_id", user.user.id)
        .limit(1);

      const appt = freshAppts?.[0];
      const apptDesc = appt?.description;
      if (apptDesc && hydrated?.descricao !== apptDesc) {
        await supabase
          .from("clientes_sessoes")
          .update({ descricao: apptDesc, updated_by: user.user.id })
          .eq("id", hydrated.id)
          .eq("user_id", user.user.id);
        hydrated.descricao = apptDesc;
      }

      console.log(
        "✅ Session already exists for appointment:",
        appointmentId,
      );
      return hydrated;
    }

    console.log("🧴 [Workflow] Hidratando appointment do banco (sempre)...");

    const { data: freshAppointment, error: hydrationError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .eq("user_id", user.user.id)
      .single();

    if (hydrationError || !freshAppointment) {
      console.error(
        "❌ [Workflow] Falha ao hidratar appointment:",
        hydrationError,
      );
      throw new Error("Failed to fetch appointment from database");
    }

    const hydratedData = {
      ...freshAppointment,
      package_id: freshAppointment.package_id,
      packageId: freshAppointment.package_id,
      cliente_id: freshAppointment.cliente_id,
      clienteId: freshAppointment.cliente_id,
      date: freshAppointment.date,
      time: freshAppointment.time,
      type: freshAppointment.type,
      description: freshAppointment.description,
      title: freshAppointment.title,
      paid_amount: freshAppointment.paid_amount,
      paidAmount: freshAppointment.paid_amount,
    };

    console.log("🧴 [Workflow] Appointment hidratado com sucesso:", {
      package_id: hydratedData.package_id,
      cliente_id: hydratedData.cliente_id,
      type: hydratedData.type,
    });

    const sessionId = hydratedData.session_id || generateUniversalSessionId("workflow");

    let packageData = null;
    let categoria = "";
    let nomePacote = "";
    let valorTotal = 0;

    const resolvedPackageId =
      hydratedData.package_id || hydratedData.packageId;
    console.log("📦 [Workflow] resolvedPackageId:", resolvedPackageId);

    if (resolvedPackageId) {
      console.log("📦 Loading package data for:", resolvedPackageId);

      const { data: pacote, error: packageError } = await supabase
        .from("pacotes")
        .select("*, categorias(nome)")
        .eq("id", resolvedPackageId)
        .eq("user_id", user.user.id)
        .single();

      if (packageError) {
        console.error("❌ Error loading package:", packageError);
        const { data: pacoteSemJoin, error: errorSemJoin } = await supabase
          .from("pacotes")
          .select("*")
          .eq("id", resolvedPackageId)
          .eq("user_id", user.user.id)
          .maybeSingle();

        if (errorSemJoin) {
          console.error("❌ Erro mesmo sem JOIN:", errorSemJoin);
        } else if (pacoteSemJoin) {
          packageData = pacoteSemJoin;
          nomePacote = pacoteSemJoin.nome || "";
          valorTotal = Number(pacoteSemJoin.valor_base) || 0;

          if (pacoteSemJoin.categoria_id) {
            const { data: cat } = await supabase
              .from("categorias")
              .select("nome")
              .eq("id", pacoteSemJoin.categoria_id)
              .maybeSingle();

            if (cat) {
              categoria = cat.nome;
              console.log("✅ Categoria carregada separadamente:", categoria);
            }
          }
        }
      } else if (pacote) {
        packageData = pacote;
        nomePacote = pacote.nome || "";
        categoria = (pacote as any).categorias?.nome || "";
        valorTotal = Number(pacote.valor_base) || 0;
      }
    }

    let clienteId = appointmentData.cliente_id || appointmentData.clienteId;
    const rawClientName =
      appointmentData.client || appointmentData.title || "";
    const cleanClientName = rawClientName
      .replace(/^(sessão|ensaio|reunião|reuniao)\s*[-–—:]\s*/i, "")
      .replace(/\s*[-–—:]\s*(sessão|ensaio|reunião|reuniao)$/i, "")
      .trim();

    if (!clienteId && cleanClientName) {
      console.log("👤 Searching for client by name:", cleanClientName);
      const { data: cliente } = await supabase
        .from("clientes")
        .select("id")
        .ilike("nome", cleanClientName)
        .eq("user_id", user.user.id)
        .maybeSingle();

      if (cliente) {
        clienteId = cliente.id;
        await supabase
          .from("appointments")
          .update({ cliente_id: clienteId })
          .eq("id", appointmentId);
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from("clientes")
          .insert({
            user_id: user.user.id,
            nome: cleanClientName,
            telefone: "Não informado",
            origem: "agenda",
          })
          .select()
          .single();

        if (newClient && !clientError) {
          clienteId = newClient.id;
          await supabase
            .from("appointments")
            .update({ cliente_id: clienteId })
            .eq("id", appointmentId);
        }
      }
    }

    const { pricingFreezingService } =
      await import("@/services/PricingFreezingService");

    const packageId =
      hydratedData.package_id ||
      hydratedData.packageId ||
      appointmentData.package_id ||
      appointmentData.packageId;

    let regrasCongeladas: any;
    let valorBasePacote = 0;

    if (packageId) {
      regrasCongeladas = await pricingFreezingService.congelarDadosCompletos(
        packageId,
        categoria,
      );

      if (!regrasCongeladas || !regrasCongeladas.pacote) {
        if (packageData) {
          valorBasePacote = Number(packageData.valor_base) || 0;
          const categoriaFinal =
            (packageData as any).categorias?.nome || categoria || "Sessão";
          regrasCongeladas =
            await pricingFreezingService.congelarDadosCompletos(
              packageData.id,
              categoriaFinal,
            );
        } else {
          valorBasePacote = 0;
          regrasCongeladas = {
            modelo: "completo",
            dataCongelamento: new Date().toISOString(),
            produtos: [],
            precificacaoFotoExtra: { modelo: "fixo" },
          };
        }
      } else {
        valorBasePacote =
          Number(regrasCongeladas.valorBase) ||
          Number(regrasCongeladas.pacote?.valorBase) ||
          Number(packageData?.valor_base) ||
          0;
      }
    } else {
      if (valorTotal > 0) {
        valorBasePacote = valorTotal;
      }

      regrasCongeladas = {
        modelo: "completo",
        dataCongelamento: new Date().toISOString(),
        produtos: [],
        precificacaoFotoExtra: { modelo: "fixo" },
      };
    }

    const valorFotoExtraInicial = regrasCongeladas
      ? pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(
          1,
          regrasCongeladas,
        ).valorUnitario
      : 0;

    const descricao =
      hydratedData.description || appointmentData.description || "";

    let finalCategoria = "Sessão";
    let categoriaData = null;

    if (packageData) {
      const { data: cat } = await supabase
        .from("categorias")
        .select("nome")
        .eq("id", packageData.categoria_id)
        .maybeSingle();

      if (cat) {
        categoriaData = cat;
        finalCategoria = cat.nome;
      }
    }

    if (
      !categoriaData &&
      hydratedData.type &&
      hydratedData.type !== nomePacote
    ) {
      finalCategoria = hydratedData.type;
    }

    if (finalCategoria === nomePacote) {
      finalCategoria = categoriaData?.nome || "Sessão";
    }

    const sessionData = {
      user_id: user.user.id,
      session_id: sessionId,
      appointment_id: appointmentId,
      cliente_id: clienteId || "",
      data_sessao: formatDateForStorage(hydratedData.date),
      hora_sessao: hydratedData.time,
      categoria: finalCategoria,
      pacote: nomePacote || "",
      descricao: descricao,
      valor_base_pacote: valorBasePacote,
      status: null,
      valor_total: valorTotal,
      valor_pago: Number(
        hydratedData.paidAmount || hydratedData.paid_amount || 0,
      ),
      produtos_incluidos: packageData?.produtos_incluidos || [],
      valor_foto_extra:
        Number(packageData?.valor_foto_extra) || valorFotoExtraInicial || 0,
      qtd_fotos_extra: 0,
      valor_total_foto_extra: 0,
      regras_congeladas: regrasCongeladas as any,
      updated_by: user.user.id,
    };

    if (valorBasePacote > 0 && valorTotal < valorBasePacote) {
      sessionData.valor_total = valorBasePacote;
    }

    const { data, error } = await supabase
      .from("clientes_sessoes")
      .insert(sessionData)
      .select(
        `
        *,
        clientes (
          nome,
          email,
          telefone,
          whatsapp
        )
      `,
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await supabase
          .from("clientes_sessoes")
          .select("*")
          .eq("user_id", user.user.id)
          .eq("appointment_id", appointmentId)
          .single();
        return existing;
      }
      throw error;
    }

    if (data) {
      await supabase
        .from("appointments")
        .update({ session_id: data.session_id })
        .eq("id", appointmentId)
        .eq("user_id", user.user.id);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("workflow-session-created", {
          detail: { session: data },
        }),
      );
    }

    return data;
  } catch (error) {
    console.error(
      "❌ Error creating workflow session from appointment:",
      error,
    );
    throw error;
  }
}

/**
 * Cria sessão de workflow a partir de agendamento confirmado com prevenção de corrida
 */
export async function createSessionFromAppointment(
  appointmentId: string,
  appointmentData: any,
) {
  const existingLock = creationLocks.get(appointmentId);
  if (existingLock) {
    console.log(
      "⏳ [WorkflowService] Session creation already in progress for:",
      appointmentId,
    );
    return existingLock;
  }

  const creationPromise = _createSessionInternal(
    appointmentId,
    appointmentData,
  );
  creationLocks.set(appointmentId, creationPromise);

  try {
    const result = await creationPromise;
    return result;
  } finally {
    setTimeout(() => {
      creationLocks.delete(appointmentId);
    }, 5000);
  }
}
