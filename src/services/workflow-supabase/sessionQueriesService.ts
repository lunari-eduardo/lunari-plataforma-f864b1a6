import { supabase } from "@/integrations/supabase/client";

/**
 * Update appointment link in existing session
 */
export async function linkAppointmentToSession(
  sessionId: string,
  appointmentId: string,
) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("User not authenticated");

    const { error } = await supabase
      .from("clientes_sessoes")
      .update({
        appointment_id: appointmentId,
        updated_by: user.user.id,
      })
      .eq("session_id", sessionId)
      .eq("user_id", user.user.id);

    if (error) throw error;

    console.log("✅ Session linked to appointment:", {
      sessionId,
      appointmentId,
    });
  } catch (error) {
    console.error("❌ Error linking session to appointment:", error);
    throw error;
  }
}

/**
 * Get sessions for a specific month with package information
 */
export async function getSessionsForMonth(month: number, year: number) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("User not authenticated");

    const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
    const endDate =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${(month + 1).toString().padStart(2, "0")}-01`;

    const { data, error } = await supabase
      .from("clientes_sessoes")
      .select(
        `
        *,
        clientes (nome, email, telefone),
        appointments (status, package_id, 
          pacotes (nome, valor_base, valor_foto_extra, produtos_incluidos, 
            categorias (nome)
          )
        )
      `,
      )
      .eq("user_id", user.user.id)
      .gte("data_sessao", startDate)
      .lt("data_sessao", endDate)
      .or("status.is.null,status.not.in.(historico,stub)")
      .order("data_sessao", { ascending: true })
      .order("hora_sessao", { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("❌ Error getting sessions for month:", error);
    throw error;
  }
}
