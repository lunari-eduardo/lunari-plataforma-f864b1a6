/**
 * Helper compartilhado entre as edge functions do Gestão (e potencialmente do Gallery)
 * para validar e materializar o contrato `cobrancas.finalidade / galeria_id / qtd_fotos`.
 *
 * Mantém um único ponto de verdade — sem isto cada função reimplementaria a
 * regra e voltaríamos ao bug de "INSERT sem finalidade" que tornou os pagamentos
 * de fotos extras invisíveis para o Gallery.
 */

export type CobrancaFinalidade = "sessao" | "fotos_extras" | "sessao_e_extras";

export interface RawBindingInput {
  finalidade?: CobrancaFinalidade | string | null;
  galeriaId?: string | null;
  sessionId?: string | null;
  qtdFotos?: number | null;
  snapshotFotosIncluidas?: number | null;
  correlationId?: string | null;
  /**
   * Componentes obrigatórios quando `finalidade='sessao_e_extras'`.
   * Devem somar exatamente `valorTotal` (±0,01).
   */
  valorSessaoComponente?: number | null;
  valorExtrasComponente?: number | null;
  /**
   * Valor total da cobrança — usado para validar a soma dos componentes
   * em cobranças combinadas. Opcional em `sessao`/`fotos_extras`.
   */
  valorTotal?: number | null;
}

export interface ResolvedBinding {
  finalidade: CobrancaFinalidade;
  galeria_id: string | null;
  qtd_fotos: number | null;
  snapshot_fotos_incluidas: number | null;
  correlation_id: string;
  valor_sessao_componente: number | null;
  valor_extras_componente: number | null;
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
    | "AMBIGUOUS_PURPOSE_USE_FOTOS_EXTRAS"
    | "MISSING_COMBINED_BREAKDOWN"
    | "INVALID_COMBINED_BREAKDOWN";
  message: string;
  // deno-lint-ignore no-explicit-any
  details?: Record<string, any>;
}

/**
 * Valida o body recebido pela edge function, checa ownership da galeria
 * (quando finalidade='fotos_extras' e galeriaId informado) e devolve as colunas prontas para o INSERT.
 *
 * Compat: se `finalidade` vier `undefined`/`null`, assume `'sessao'` para não
 * quebrar callers antigos.
 */
export async function resolveCobrancaBinding(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  raw: RawBindingInput,
  /**
   * Whitelist de finalidades aceitas pelo caller.
   */
  allowedFinalidades: CobrancaFinalidade[] = ["sessao", "sessao_e_extras"],
): Promise<{ binding?: ResolvedBinding; error?: BindingError }> {
  const finalidadeRaw = (raw.finalidade ?? "sessao").toString().toLowerCase();

  if (
    finalidadeRaw !== "sessao" &&
    finalidadeRaw !== "fotos_extras" &&
    finalidadeRaw !== "sessao_e_extras"
  ) {
    return {
      error: {
        code: "INVALID_FINALIDADE",
        message:
          `Finalidade inválida: ${finalidadeRaw}. Aceitas: 'sessao', 'fotos_extras' ou 'sessao_e_extras'.`,
      },
    };
  }

  if (!allowedFinalidades.includes(finalidadeRaw as CobrancaFinalidade)) {
    return {
      error: {
        code: "INVALID_FINALIDADE",
        message:
          `Finalidade '${finalidadeRaw}' não é permitida neste endpoint. ` +
          `Aceitas aqui: ${allowedFinalidades.join(", ")}.`,
        details: { allowedFinalidades, received: finalidadeRaw },
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
        valor_sessao_componente: null,
        valor_extras_componente: null,
      },
    };
  }

  // fotos_extras OR sessao_e_extras → galeriaId ou sessionId obrigatório
  if (!raw.galeriaId && !raw.sessionId) {
    return {
      error: {
        code: "MISSING_GALLERY_BINDING",
        message:
          "Cobrança de fotos extras exige galeriaId ou sessionId. Vincule a galeria ou sessão antes de cobrar.",
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

  let galId: string | null = null;
  if (raw.galeriaId) {
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
    galId = gal.id;
  }

  const snapshot_fotos_incluidas =
    raw.snapshotFotosIncluidas != null
      ? Number(raw.snapshotFotosIncluidas)
      : null;

  if (finalidadeRaw === "fotos_extras") {
    return {
      binding: {
        finalidade: "fotos_extras",
        galeria_id: galId,
        qtd_fotos: Math.trunc(qtd),
        snapshot_fotos_incluidas,
        correlation_id,
        valor_sessao_componente: null,
        valor_extras_componente: null,
      },
    };
  }

  // finalidade === 'sessao_e_extras' → componentes (vSessao pode ser 0 para extras_only)
  const vSessao = Number(raw.valorSessaoComponente ?? 0);
  const vExtras = Number(raw.valorExtrasComponente ?? NaN);
  const vTotal = Number(raw.valorTotal ?? NaN);

  if (
    !Number.isFinite(vSessao) || vSessao < 0 ||
    !Number.isFinite(vExtras) || vExtras <= 0
  ) {
    return {
      error: {
        code: "MISSING_COMBINED_BREAKDOWN",
        message:
          "Cobrança combinada exige valorExtrasComponente maior que zero e valorSessaoComponente não-negativo.",
      },
    };
  }

  if (Number.isFinite(vTotal)) {
    const soma = Number((vSessao + vExtras).toFixed(2));
    if (Math.abs(soma - Number(vTotal.toFixed(2))) > 0.01) {
      return {
        error: {
          code: "INVALID_COMBINED_BREAKDOWN",
          message:
            `Soma dos componentes (R$ ${soma.toFixed(2)}) não bate com valor total (R$ ${vTotal.toFixed(2)}).`,
          details: { vSessao, vExtras, vTotal, soma },
        },
      };
    }
  }

  return {
    binding: {
      finalidade: "sessao_e_extras",
      galeria_id: galId,
      qtd_fotos: Math.trunc(qtd),
      snapshot_fotos_incluidas,
      correlation_id,
      valor_sessao_componente: Number(vSessao.toFixed(2)),
      valor_extras_componente: Number(vExtras.toFixed(2)),
    },
  };
}

/**
 * Cancela cobranças pendentes anteriores (mesma sessão, outro id) para evitar
 * "duas cobranças abertas" quando o usuário emite uma nova (tipicamente uma
 * combinada `sessao_e_extras`). Marca `status='cancelado'` — o webhook
 * eventual já é idempotente e ignora cobranças canceladas.
 *
 * Só cancela cobranças `pendente` (não `pago`, `parcialmente_pago`, etc).
 */
export async function cancelStalePendingChargesForSession(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  sessionId: string,
  keepCobrancaId: string,
): Promise<{ cancelled: number }> {
  const { data, error } = await supabase
    .from("cobrancas")
    .update({ status: "cancelado" })
    .eq("session_id", sessionId)
    .eq("status", "pendente")
    .neq("id", keepCobrancaId)
    .select("id");

  if (error) {
    console.error("cancelStalePendingChargesForSession error:", error);
    return { cancelled: 0 };
  }
  return { cancelled: (data ?? []).length };
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
  bypassPreSelecaoGate = true,
): Promise<{ error?: BindingError; snapshot?: Record<string, unknown> }> {
  const { data, error } = await supabase.rpc(
    "calculate_gallery_extra_payment",
    { p_gallery_id: galeriaId, p_bypass_pre_selecao_gate: bypassPreSelecaoGate },
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
