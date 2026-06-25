/**
 * Helper compartilhado entre as edge functions do Gestão (e potencialmente do Gallery)
 * para validar e materializar o contrato `cobrancas.finalidade / galeria_id / qtd_fotos`.
 *
 * Mantém um único ponto de verdade — sem isto cada função reimplementaria a
 * regra e voltaríamos ao bug de "INSERT sem finalidade" que tornou os pagamentos
 * de fotos extras invisíveis para o Gallery.
 */

export type CobrancaFinalidade = "sessao" | "fotos_extras";

export interface RawBindingInput {
  finalidade?: CobrancaFinalidade | string | null;
  galeriaId?: string | null;
  qtdFotos?: number | null;
  snapshotFotosIncluidas?: number | null;
  correlationId?: string | null;
}

export interface ResolvedBinding {
  finalidade: CobrancaFinalidade;
  galeria_id: string | null;
  qtd_fotos: number | null;
  snapshot_fotos_incluidas: number | null;
  correlation_id: string;
}

export interface BindingError {
  code:
    | "MISSING_GALLERY_BINDING"
    | "INVALID_QTD_FOTOS"
    | "GALLERY_FORBIDDEN"
    | "GALLERY_NOT_FOUND"
    | "INVALID_FINALIDADE"
    | "EXTRA_PAYMENT_RPC_FAILED"
    | "EXTRA_PAYMENT_EXCEEDS_IDEAL"
    | "AMBIGUOUS_PURPOSE_USE_FOTOS_EXTRAS";
  message: string;
  // deno-lint-ignore no-explicit-any
  details?: Record<string, any>;
}

/**
 * Valida o body recebido pela edge function, checa ownership da galeria
 * (quando finalidade='fotos_extras') e devolve as colunas prontas para o INSERT.
 *
 * Compat: se `finalidade` vier `undefined`/`null`, assume `'sessao'` para não
 * quebrar callers antigos.
 */
export async function resolveCobrancaBinding(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  raw: RawBindingInput,
): Promise<{ binding?: ResolvedBinding; error?: BindingError }> {
  const finalidadeRaw = (raw.finalidade ?? "sessao").toString().toLowerCase();

  if (finalidadeRaw !== "sessao" && finalidadeRaw !== "fotos_extras") {
    return {
      error: {
        code: "INVALID_FINALIDADE",
        message: `Finalidade inválida: ${finalidadeRaw}. Aceitas: 'sessao' ou 'fotos_extras'.`,
      },
    };
  }

  const correlation_id = raw.correlationId ?? crypto.randomUUID();

  if (finalidadeRaw === "sessao") {
    return {
      binding: {
        finalidade: "sessao",
        galeria_id: null,
        qtd_fotos: null,
        snapshot_fotos_incluidas: null,
        correlation_id,
      },
    };
  }

  // finalidade === 'fotos_extras' → galeriaId + qtdFotos obrigatórios
  if (!raw.galeriaId) {
    return {
      error: {
        code: "MISSING_GALLERY_BINDING",
        message:
          "Cobrança de fotos extras exige galeriaId. Vincule a galeria antes de cobrar.",
      },
    };
  }

  const qtd = Number(raw.qtdFotos ?? 0);
  if (!Number.isFinite(qtd) || qtd <= 0) {
    return {
      error: {
        code: "INVALID_QTD_FOTOS",
        message: "qtdFotos deve ser um número inteiro maior que zero.",
      },
    };
  }

  // Confirma ownership: a galeria precisa pertencer ao mesmo usuário.
  const { data: gal, error: galErr } = await supabase
    .from("galerias")
    .select("id, user_id")
    .eq("id", raw.galeriaId)
    .maybeSingle();

  if (galErr || !gal) {
    return {
      error: {
        code: "GALLERY_NOT_FOUND",
        message: "Galeria não encontrada.",
      },
    };
  }

  if (gal.user_id !== userId) {
    return {
      error: {
        code: "GALLERY_FORBIDDEN",
        message: "Esta galeria não pertence ao usuário autenticado.",
      },
    };
  }

  return {
    binding: {
      finalidade: "fotos_extras",
      galeria_id: gal.id,
      qtd_fotos: Math.trunc(qtd),
      snapshot_fotos_incluidas:
        raw.snapshotFotosIncluidas != null
          ? Number(raw.snapshotFotosIncluidas)
          : null,
      correlation_id,
    },
  };
}
