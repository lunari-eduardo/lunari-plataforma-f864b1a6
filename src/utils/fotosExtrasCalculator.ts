/**
 * Helper puro de recálculo de fotos extras do Workflow.
 * 
 * Mantém paridade com as triggers do Supabase:
 *  - recalc_fotos_extras (calcula valor_total_foto_extra = qtd × valor)
 *  - recalculate_session_valor_total (valor_total = base + fotos + produtos + adicional − desconto)
 *  - z_protect_session_extras_consistency (força valores da galeria quando existem vendas)
 *
 * Também aplica regras de desconto progressivo congeladas, quando presentes,
 * usando PricingFreezingService.
 */

import { pricingFreezingService } from '@/services/PricingFreezingService';

export interface RecalcFotosExtrasInput {
  qtd: number;
  valorFotoExtra: number;
  regrasCongeladas?: any;
  /** Informações da galeria vinculada (se existir) */
  galeriaInfo?: {
    galeriaId?: string | null;
    valorTotalVendido?: number | null;
    totalFotosExtrasVendidas?: number | null;
  };
}

export interface RecalcFotosExtrasResult {
  valorUnitarioEfetivo: number;
  valorTotalFotoExtra: number;
  /** true quando a UI não deve sobrescrever — o banco (via trigger) tem a verdade */
  respeitarBanco: boolean;
}

/**
 * Recalcula valor total das fotos extras de uma sessão.
 * Retorna também o valor unitário efetivo (pode diferir do informado caso haja desconto progressivo).
 */
export function recalcFotosExtras(input: RecalcFotosExtrasInput): RecalcFotosExtrasResult {
  const qtd = Math.max(0, Math.floor(Number(input.qtd) || 0));
  const valorInformado = Math.max(0, Number(input.valorFotoExtra) || 0);
  const galeria = input.galeriaInfo;

  // 1. Galeria com vendas consolidadas e qtd bate → respeitar banco.
  if (
    galeria?.galeriaId &&
    galeria.valorTotalVendido != null &&
    galeria.valorTotalVendido > 0 &&
    galeria.totalFotosExtrasVendidas != null &&
    galeria.totalFotosExtrasVendidas > 0 &&
    qtd === galeria.totalFotosExtrasVendidas
  ) {
    const vt = Number(galeria.valorTotalVendido);
    return {
      valorUnitarioEfetivo: qtd > 0 ? Number((vt / qtd).toFixed(2)) : 0,
      valorTotalFotoExtra: vt,
      respeitarBanco: true,
    };
  }

  // 2. Fallback de preço: se unitário informado = 0, tentar regras congeladas.
  // Isto espelha o fallback aplicado na trigger recalculate_fotos_extras_total.
  const pacoteCong = input.regrasCongeladas?.pacote;
  const precoCongEfet = Number(pacoteCong?.valorFotoExtraEfetivo) || 0;
  const precoCongBase = Number(pacoteCong?.valorFotoExtra) || 0;
  const valorUnitResolvido =
    valorInformado > 0
      ? valorInformado
      : precoCongEfet > 0
        ? precoCongEfet
        : precoCongBase;

  // 3. Quantidade zero → total zero (mas já resolvemos o unitário para UI).
  if (qtd === 0) {
    return {
      valorUnitarioEfetivo: valorUnitResolvido,
      valorTotalFotoExtra: 0,
      respeitarBanco: false,
    };
  }

  // 4. Regras congeladas com desconto progressivo → usar serviço (faixas por qtd).
  if (pacoteCong) {
    try {
      const resultado = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(
        qtd,
        input.regrasCongeladas,
      );
      const valorUnit = Number(resultado.valorUnitario) || valorUnitResolvido;
      const total = Number(resultado.valorTotal) || qtd * valorUnit;
      return {
        valorUnitarioEfetivo: valorUnit,
        valorTotalFotoExtra: Number(total.toFixed(2)),
        respeitarBanco: false,
      };
    } catch (e) {
      console.warn('[recalcFotosExtras] Falha regras congeladas, usando qtd × valor:', e);
    }
  }

  // 5. Cálculo padrão: qtd × valor unitário resolvido.
  return {
    valorUnitarioEfetivo: valorUnitResolvido,
    valorTotalFotoExtra: Number((qtd * valorUnitResolvido).toFixed(2)),
    respeitarBanco: false,
  };
}

/**
 * Recompõe valor_total da sessão seguindo a mesma fórmula do trigger
 * recalculate_session_valor_total.
 */
export function recalcSessionValorTotal(input: {
  valorBasePacote?: number;
  valorTotalFotoExtra?: number;
  produtosIncluidos?: any[];
  valorAdicional?: number;
  desconto?: number;
}): number {
  const base = Number(input.valorBasePacote) || 0;
  const fotos = Number(input.valorTotalFotoExtra) || 0;
  const adicional = Number(input.valorAdicional) || 0;
  const desconto = Number(input.desconto) || 0;

  const produtos = Array.isArray(input.produtosIncluidos)
    ? input.produtosIncluidos.reduce((acc: number, p: any) => {
        if (p?.tipo === 'manual') {
          return acc + (Number(p.quantidade) || 0) * (Number(p.valorUnitario) || 0);
        }
        return acc;
      }, 0)
    : 0;

  return Math.max(0, base + fotos + produtos + adicional - desconto);
}
