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

/**
 * Garante que `valor` solicitado não excede o saldo ideal calculado pela RPC
 * canônica `calculate_gallery_extra_payment` (regra congelada + descontos +
 * abatimento do que já foi pago). Tolerância de R$0,01 para float.
 */
export async function assertExtraPaymentWithinIdeal(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  galeriaId: string,
  valor: number,
): Promise<{ error?: BindingError; snapshot?: Record<string, unknown> }> {
  const { data, error } = await supabase.rpc(
    "calculate_gallery_extra_payment",
    { p_gallery_id: galeriaId },
  );

  if (error || !data || data.success === false) {
    return {
      error: {
        code: "EXTRA_PAYMENT_RPC_FAILED",
        message:
          (data && data.error) || error?.message ||
          "Não foi possível calcular o saldo de fotos extras desta galeria.",
      },
    };
  }

  const idealRemaining = Number(data.valor_a_cobrar ?? 0);
  if (valor > idealRemaining + 0.01) {
    return {
      error: {
        code: "EXTRA_PAYMENT_EXCEEDS_IDEAL",
        message:
          `Valor R$ ${valor.toFixed(2)} excede o saldo ideal de R$ ${idealRemaining.toFixed(2)}` +
          ` (já pago R$ ${Number(data.valor_pago ?? 0).toFixed(2)}). Fonte: ${data.rules_source ?? "regra atual"}.`,
        details: data,
      },
      snapshot: data,
    };
  }

  return { snapshot: data };
}

/**
 * Detecta cobranças `finalidade='sessao'` cujo valor coincide com o saldo de
 * fotos extras de alguma galeria da mesma sessão (±1%). Caso positivo,
 * bloqueia para forçar o uso de `finalidade='fotos_extras'` e evitar a
 * cobrança "fantasma" que travava a galeria em aguardando_pagamento.
 *
 * Bypass: callers podem passar `allowAmbiguous=true` para confirmar explicitamente.
 */
export async function assertNotAmbiguousSessionCharge(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  sessionId: string,
  valor: number,
  allowAmbiguous = false,
): Promise<{ error?: BindingError }> {
  if (allowAmbiguous) return {};

  const { data: galerias } = await supabase
    .from("galerias")
    .select(
      "id, nome_sessao, fotos_selecionadas, fotos_incluidas, status_pagamento",
    )
    .eq("session_id", sessionId);

  if (!galerias || galerias.length === 0) return {};

  for (const g of galerias as Array<Record<string, unknown>>) {
    const selecionadas = Number(g.fotos_selecionadas ?? 0);
    const incluidas = Number(g.fotos_incluidas ?? 0);
    if (selecionadas <= incluidas) continue;
    if (g.status_pagamento === "pago") continue;

    const { data: rpc } = await supabase.rpc(
      "calculate_gallery_extra_payment",
      { p_gallery_id: g.id },
    );
    if (!rpc || rpc.success === false) continue;
    const saldo = Number(rpc.valor_a_cobrar ?? 0);
    if (saldo <= 0) continue;

    // Considera ambíguo se valor estiver dentro de ±1% do saldo de extras
    const tolerancia = Math.max(saldo * 0.01, 0.01);
    if (Math.abs(valor - saldo) <= tolerancia) {
      return {
        error: {
          code: "AMBIGUOUS_PURPOSE_USE_FOTOS_EXTRAS",
          message:
            `Esta sessão tem R$ ${saldo.toFixed(2)} pendentes em fotos extras da galeria "${g.nome_sessao ?? "—"}". ` +
            `Cobrar como "sessão" duplicaria a receita. Use finalidade='fotos_extras' ou confirme explicitamente.`,
          details: {
            galeriaId: g.id,
            valorSaldoExtras: saldo,
            qtdSugerida: Number(rpc.extras_necessarias ?? 0) -
              Number(rpc.extras_pagas ?? 0),
          },
        },
      };
    }
  }

  return {};
}
