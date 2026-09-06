import { supabase } from "@/integrations/supabase/client";

/**
 * Migrate localStorage data to Supabase
 */
export async function migrateLocalStorageData(): Promise<{ migrated: number; skipped: number }> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("User not authenticated");

    const savedSessions = localStorage.getItem("workflow_sessions");
    if (!savedSessions) return { migrated: 0, skipped: 0 };

    const sessions = JSON.parse(savedSessions);
    let migrated = 0;
    let skipped = 0;

    for (const session of sessions) {
      try {
        const { data: existing } = await supabase
          .from("clientes_sessoes")
          .select("id")
          .eq("session_id", session.id)
          .eq("user_id", user.user.id)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        let clienteId = session.clienteId;
        if (!clienteId && session.nome) {
          const { data: cliente } = await supabase
            .from("clientes")
            .select("id")
            .eq("nome", session.nome)
            .eq("user_id", user.user.id)
            .single();

          if (cliente) {
            clienteId = cliente.id;
          }
        }

        const parseValue = (value: string | number) => {
          if (typeof value === "number") return value;
          return (
            parseFloat(value.replace(/[^\d,]/g, "").replace(",", ".")) || 0
          );
        };

        const sessionData = {
          user_id: user.user.id,
          session_id: session.id,
          cliente_id: clienteId || "",
          data_sessao: session.data,
          hora_sessao: session.hora,
          categoria: session.categoria || "Outros",
          pacote: session.pacote || "",
          descricao: session.descricao || "",
          status: session.status ?? null,
          valor_total: parseValue(session.total || session.valorPacote || 0),
          valor_pago: parseValue(session.valorPago || 0),
          produtos_incluidos: session.produtosList || [],
          updated_by: user.user.id,
        };

        const { error } = await supabase
          .from("clientes_sessoes")
          .insert(sessionData);

        if (!error) {
          migrated++;
        } else {
          console.error("Error migrating session:", session.id, error);
        }
      } catch (sessionError) {
        console.error("Error processing session:", session.id, sessionError);
      }
    }

    console.log(
      `✅ Migration complete: ${migrated} migrated, ${skipped} skipped`,
    );
    return { migrated, skipped };
  } catch (error) {
    console.error("❌ Error migrating localStorage data:", error);
    throw error;
  }
}

/**
 * Reparar divergências entre appointments e clientes_sessoes
 */
export async function repairAppointmentsSessionsMismatch(
  createSessionFromAppointmentFn: (appointmentId: string, appointment: any) => Promise<any>
): Promise<void> {
  try {
    console.log("🔧 [Repair] Iniciando reparo de divergências...");

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      console.log("⚠️ [Repair] User not authenticated, skipping repair");
      return;
    }

    // 1. Buscar appointments confirmados sem sessão
    const { data: appointmentsWithoutSession } = await supabase
      .from("appointments")
      .select("*")
      .eq("user_id", user.user.id)
      .eq("status", "confirmado")
      .is("session_id", null);

    if (appointmentsWithoutSession && appointmentsWithoutSession.length > 0) {
      console.log(
        `🔧 [Repair] Encontrados ${appointmentsWithoutSession.length} appointments sem sessão`,
      );

      for (const appointment of appointmentsWithoutSession) {
        try {
          await createSessionFromAppointmentFn(
            appointment.id,
            appointment,
          );
          console.log(
            `✅ [Repair] Sessão criada para appointment ${appointment.id}`,
          );
        } catch (error) {
          console.error(
            `❌ [Repair] Erro ao criar sessão para ${appointment.id}:`,
            error,
          );
        }
      }
    }

    // 2. Buscar sessões com appointment_id e verificar divergências de data/hora
    const { data: sessionsWithAppointment } = await supabase
      .from("clientes_sessoes")
      .select("id, appointment_id, data_sessao, hora_sessao")
      .eq("user_id", user.user.id)
      .not("appointment_id", "is", null);

    if (sessionsWithAppointment && sessionsWithAppointment.length > 0) {
      console.log(
        `🔧 [Repair] Verificando ${sessionsWithAppointment.length} sessões com appointment_id`,
      );

      for (const session of sessionsWithAppointment) {
        const { data: appointment } = await supabase
          .from("appointments")
          .select("date, time")
          .eq("id", session.appointment_id)
          .eq("user_id", user.user.id)
          .single();

        if (appointment) {
          const needsDateFix = appointment.date !== session.data_sessao;
          const needsTimeFix = appointment.time !== session.hora_sessao;

          if (needsDateFix || needsTimeFix) {
            console.log(
              `🔧 [Repair] Divergência detectada na sessão ${session.id}:`,
              {
                appointment: {
                  date: appointment.date,
                  time: appointment.time,
                },
                session: {
                  date: session.data_sessao,
                  time: session.hora_sessao,
                },
              },
            );

            await supabase
              .from("clientes_sessoes")
              .update({
                data_sessao: appointment.date,
                hora_sessao: appointment.time,
                updated_at: new Date().toISOString(),
              })
              .eq("id", session.id)
              .eq("user_id", user.user.id);

            console.log(
              `✅ [Repair] Sessão ${session.id} atualizada para corresponder ao appointment`,
            );
          }
        }
      }
    }

    console.log("✅ [Repair] Reparo concluído com sucesso");
  } catch (error) {
    console.error("❌ [Repair] Erro durante reparo:", error);
  }
}
