import type {
  FaixaPreco,
  RegrasCongeladas,
  CalculoPrecoResult,
  CalculoPrecoComCreditoResult,
} from "./types";
import { sanitizeExtraPrice, normalizarValor } from "./sanitization";
import { encontrarFaixaPreco } from "./tierLookup";

/**
 * Calculates the price for extra photos using progressive pricing rules
 *
 * @param quantidadeFotosExtras - Number of photos to charge in this cycle
 * @param regrasCongeladas - Frozen pricing rules from Gestão (or null)
 * @param valorFotoExtraFixo - Fallback fixed price per photo
 * @param quantidadeParaFaixa - Optional: total accumulated extras for tier calculation (if not provided, uses quantidadeFotosExtras)
 * @returns Calculation result with unit price, total, and savings
 */
export function calcularPrecoProgressivo(
  quantidadeFotosExtras: number,
  regrasCongeladas: RegrasCongeladas | null | undefined,
  valorFotoExtraFixo: number,
  quantidadeParaFaixa?: number, // NEW: Optional - for cumulative tier lookup
): CalculoPrecoResult {
  // Use quantidadeParaFaixa for tier lookup, or fallback to quantity to charge
  const qtdParaBuscarFaixa = quantidadeParaFaixa ?? quantidadeFotosExtras;

  // Normalize fallback value (might be in cents from Gestão)
  const fallbackNormalizado = normalizarValor(valorFotoExtraFixo);

  // Default/fallback result
  const fallbackResult: CalculoPrecoResult = {
    valorUnitario: fallbackNormalizado,
    valorTotal: quantidadeFotosExtras * fallbackNormalizado,
    modeloUsado: "fixo",
  };

  // No extras or no rules - use fixed price
  if (quantidadeFotosExtras <= 0) {
    return { ...fallbackResult, valorTotal: 0 };
  }

  if (!regrasCongeladas?.precificacaoFotoExtra) {
    return fallbackResult;
  }

  const regras = regrasCongeladas.precificacaoFotoExtra;
  // Resolve base price with "JSON wins" rule:
  // The session's `regras_congeladas.pacote.valorFotoExtra` is the single
  // source of truth (1 sessão = 1 galeria). The scalar `valorFotoExtraFixo`
  // is only used as a fallback for legacy/standalone galleries that have no
  // frozen rules JSON.
  const fixoSanitizado = sanitizeExtraPrice(valorFotoExtraFixo);
  const regrasSanitizado = sanitizeExtraPrice(regrasCongeladas.pacote?.valorFotoExtra ?? 0);
  const precoBasePacote = regrasSanitizado > 0 ? regrasSanitizado : fixoSanitizado;

  let valorUnitario = 0;
  let faixaAtual: FaixaPreco | null = null;
  let modeloUsado: "fixo" | "global" | "categoria" = "fixo";

  switch (regras.modelo) {
    case "fixo":
      valorUnitario = precoBasePacote;
      modeloUsado = "fixo";
      break;

    case "global":
      if (regras.tabelaGlobal?.faixas) {
        // Use qtdParaBuscarFaixa for tier lookup (cumulative total)
        faixaAtual = encontrarFaixaPreco(qtdParaBuscarFaixa, regras.tabelaGlobal.faixas);
        valorUnitario = faixaAtual?.valor ? sanitizeExtraPrice(faixaAtual.valor) : precoBasePacote;
        modeloUsado = "global";
      } else {
        valorUnitario = precoBasePacote;
      }
      break;

    case "categoria":
      // Check if should use fixed price from package
      if (regras.tabelaCategoria?.usar_valor_fixo_pacote) {
        valorUnitario = precoBasePacote;
        modeloUsado = "fixo";
      } else if (regras.tabelaCategoria?.faixas) {
        // Use qtdParaBuscarFaixa for tier lookup (cumulative total)
        faixaAtual = encontrarFaixaPreco(qtdParaBuscarFaixa, regras.tabelaCategoria.faixas);
        valorUnitario = faixaAtual?.valor ? sanitizeExtraPrice(faixaAtual.valor) : precoBasePacote;
        modeloUsado = "categoria";
      } else {
        valorUnitario = precoBasePacote;
      }
      break;

    default:
      valorUnitario = sanitizeExtraPrice(valorFotoExtraFixo);
  }

  // Ensure we have a valid price
  if (!valorUnitario || valorUnitario <= 0) {
    valorUnitario = sanitizeExtraPrice(valorFotoExtraFixo) || precoBasePacote;
  }

  const valorTotal = valorUnitario * quantidadeFotosExtras;

  // Calculate savings compared to base price
  const valorSemDesconto = precoBasePacote * quantidadeFotosExtras;
  const economia = valorSemDesconto - valorTotal;

  return {
    valorUnitario,
    valorTotal,
    faixaAtual: faixaAtual || undefined,
    economia: economia > 0 ? economia : undefined,
    modeloUsado,
  };
}

/**
 * Calculates progressive pricing with credit system
 *
 * Formula: valor_a_cobrar = (total_extras × valor_faixa) - valor_já_pago
 *
 * This ensures the client always pays the same total regardless of how many
 * selection cycles they go through.
 *
 * @param extrasNovas - New extras selected in this cycle
 * @param extrasPagasTotal - Extras already paid from previous cycles (quantity)
 * @param valorJaPago - Total amount already paid for extras (R$)
 * @param regrasCongeladas - Frozen pricing rules from Gestão (or null)
 * @param valorFotoExtraFixo - Fallback fixed price per photo
 * @returns Calculation result with amount to charge and breakdown
 */
export function calcularPrecoProgressivoComCredito(
  extrasNovas: number,
  extrasPagasTotal: number,
  valorJaPago: number,
  regrasCongeladas: RegrasCongeladas | null | undefined,
  valorFotoExtraFixo: number,
): CalculoPrecoComCreditoResult {
  // Calculate total accumulated extras
  const totalExtras = extrasPagasTotal + extrasNovas;

  // Normalize fallback value
  const fallbackNormalizado = normalizarValor(valorFotoExtraFixo);

  // Default result for no new extras - but still show correct unit price for display
  if (extrasNovas <= 0 || totalExtras <= 0) {
    // Calculate unit price for display even when there's nothing new to charge
    // Use the average price paid (valorJaPago / extrasPagasTotal) for accuracy
    let displayUnitPrice = fallbackNormalizado;

    if (extrasPagasTotal > 0 && valorJaPago > 0) {
      // Best approach: use actual average price paid
      displayUnitPrice = valorJaPago / extrasPagasTotal;
    } else if (regrasCongeladas?.precificacaoFotoExtra) {
      // Fallback: look up the tier price for previously paid quantity
      const regras = regrasCongeladas.precificacaoFotoExtra;
      const qtdParaFaixa = extrasPagasTotal > 0 ? extrasPagasTotal : 1;

      if (regras.modelo === "global" && regras.tabelaGlobal?.faixas) {
        const faixa = encontrarFaixaPreco(qtdParaFaixa, regras.tabelaGlobal.faixas);
        if (faixa?.valor) displayUnitPrice = normalizarValor(faixa.valor);
      } else if (
        regras.modelo === "categoria" &&
        regras.tabelaCategoria?.faixas &&
        !regras.tabelaCategoria.usar_valor_fixo_pacote
      ) {
        const faixa = encontrarFaixaPreco(qtdParaFaixa, regras.tabelaCategoria.faixas);
        if (faixa?.valor) displayUnitPrice = normalizarValor(faixa.valor);
      } else {
        // Fixed pricing model — JSON wins over scalar fallback
        const valorPacote = sanitizeExtraPrice(regrasCongeladas.pacote?.valorFotoExtra ?? 0);
        const fixoNorm = sanitizeExtraPrice(valorFotoExtraFixo);
        if (valorPacote > 0) displayUnitPrice = valorPacote;
        else if (fixoNorm > 0) displayUnitPrice = fixoNorm;
      }
    }

    return {
      valorUnitario: displayUnitPrice, // Show actual average price or tier price
      valorACobrar: 0,
      valorTotalIdeal: valorJaPago,
      economia: 0,
      totalExtras: extrasPagasTotal,
      modeloUsado: "fixo",
    };
  }

  // Find the tier based on TOTAL accumulated extras (not just new ones)
  let valorUnitario = fallbackNormalizado;
  let faixaAtual: FaixaPreco | null = null;
  let modeloUsado: "fixo" | "global" | "categoria" = "fixo";

  // Resolve base price with "JSON wins" rule (see calcularPrecoProgressivo).
  // The session's frozen JSON is the single source of truth.
  const fixoSanitizado = sanitizeExtraPrice(valorFotoExtraFixo);
  const regrasSanitizado = sanitizeExtraPrice(regrasCongeladas?.pacote?.valorFotoExtra ?? 0);
  const precoBasePacote = regrasSanitizado > 0 ? regrasSanitizado : fixoSanitizado;

  if (regrasCongeladas?.precificacaoFotoExtra) {
    const regras = regrasCongeladas.precificacaoFotoExtra;

    switch (regras.modelo) {
      case "fixo":
        valorUnitario = precoBasePacote;
        modeloUsado = "fixo";
        break;

      case "global":
        if (regras.tabelaGlobal?.faixas) {
          faixaAtual = encontrarFaixaPreco(totalExtras, regras.tabelaGlobal.faixas);
          valorUnitario = faixaAtual?.valor ? normalizarValor(faixaAtual.valor) : precoBasePacote;
          modeloUsado = "global";
        } else {
          valorUnitario = precoBasePacote;
        }
        break;

      case "categoria":
        if (regras.tabelaCategoria?.usar_valor_fixo_pacote) {
          valorUnitario = precoBasePacote;
          modeloUsado = "fixo";
        } else if (regras.tabelaCategoria?.faixas) {
          faixaAtual = encontrarFaixaPreco(totalExtras, regras.tabelaCategoria.faixas);
          valorUnitario = faixaAtual?.valor ? normalizarValor(faixaAtual.valor) : precoBasePacote;
          modeloUsado = "categoria";
        } else {
          valorUnitario = precoBasePacote;
        }
        break;

      default:
        valorUnitario = fallbackNormalizado;
    }
  }

  // Ensure we have a valid price
  if (!valorUnitario || valorUnitario <= 0) {
    valorUnitario = fallbackNormalizado;
  }

  // Calculate what the total WOULD cost if bought all at once
  const valorTotalIdeal = totalExtras * valorUnitario;

  // Subtract what was already paid (credit system)
  // This ensures client pays same total regardless of number of selection cycles
  const valorACobrar = Math.max(0, valorTotalIdeal - valorJaPago);

  // Calculate savings compared to base price (first tier)
  const valorSemDesconto = totalExtras * precoBasePacote;
  const economia = Math.max(0, valorSemDesconto - valorTotalIdeal);

  return {
    valorUnitario,
    valorACobrar,
    valorTotalIdeal,
    economia,
    totalExtras,
    faixaAtual: faixaAtual || undefined,
    modeloUsado,
  };
}
