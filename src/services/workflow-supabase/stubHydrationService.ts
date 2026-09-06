import { supabase } from "@/integrations/supabase/client";

/**
 * Completa uma sessão "stub" (criada só para permitir a cobrança de entrada na
 * agenda) com os dados reais do pacote do appointment. Idempotente: só preenche
 * campos vazios e nunca toca em valor_pago nem em vínculos financeiros.
 */
export async function hydrateStubSession(
  session: any,
  appointmentId: string,
  userId: string,
) {
  try {
    const rcPacote =
      session?.regras_congeladas &&
      typeof session.regras_congeladas === "object"
        ? (session.regras_congeladas as any).pacote
        : null;

    const isStub =
      !session?.pacote ||
      !rcPacote ||
      Number(session?.valor_base_pacote || 0) === 0 ||
      session?.categoria === session?.pacote;

    if (!isStub) return session;

    const { data: appointments } = await supabase
      .from("appointments")
      .select("package_id, description, date, time, paid_amount")
      .eq("id", appointmentId)
      .eq("user_id", userId)
      .limit(1);

    const appointment = appointments?.[0] || null;

    if (!appointment?.package_id) return session;

    const { data: pkg } = await supabase
      .from("pacotes")
      .select(
        "id, nome, valor_base, valor_foto_extra, fotos_incluidas, categoria_id, produtos_incluidos, categorias ( id, nome )",
      )
      .eq("id", appointment.package_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!pkg) return session;

    const categoriaNome = (pkg.categorias as any)?.nome || "Sessão";
    const produtos = Array.isArray(pkg.produtos_incluidos)
      ? pkg.produtos_incluidos
      : [];
    const valorBase = Number(pkg.valor_base) || 0;

    const patch: Record<string, any> = {
      categoria: categoriaNome,
      pacote: pkg.nome,
      valor_base_pacote: valorBase,
      updated_by: userId,
    };

    if (!Number(session?.valor_foto_extra)) {
      patch.valor_foto_extra = Number(pkg.valor_foto_extra) || 0;
    }
    if (
      !Array.isArray(session?.produtos_incluidos) ||
      session.produtos_incluidos.length === 0
    ) {
      patch.produtos_incluidos = produtos;
    }
    if (
      appointment.description !== undefined &&
      appointment.description !== null
    ) {
      patch.descricao = appointment.description;
    }
    if (Number(session?.valor_total || 0) < valorBase) {
      patch.valor_total = valorBase;
    }
    if (!rcPacote) {
      const { pricingFreezingService } =
        await import("@/services/PricingFreezingService");
      patch.regras_congeladas =
        await pricingFreezingService.congelarDadosCompletos(
          pkg.id,
          categoriaNome,
        );
    }

    const { data: updated } = await supabase
      .from("clientes_sessoes")
      .update(patch)
      .eq("id", session.id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    console.log(
      "🩹 [Workflow] Sessão stub hidratada com dados do pacote:",
      session.id,
    );
    return updated || { ...session, ...patch };
  } catch (error) {
    console.error("⚠️ [Workflow] Falha ao hidratar sessão stub:", error);
    return session;
  }
}
