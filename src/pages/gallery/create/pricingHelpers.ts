import { RegrasCongeladas, sanitizeExtraPrice } from '@/lib/pricingUtils';

/**
 * Helper to extract the initial extra photo price from frozen rules.
 * Handles progressive pricing by getting the first tier price.
 */
export function getInitialExtraPrice(regras: RegrasCongeladas | null): number {
  if (!regras) return 0;
  const precificacao = regras.precificacaoFotoExtra;

  // Fixed model: use package price
  if (!precificacao || precificacao.modelo === 'fixo') {
    return regras.pacote?.valorFotoExtra || 0;
  }

  // Global model: get first tier price
  if (precificacao.modelo === 'global' && precificacao.tabelaGlobal?.faixas?.length) {
    const sortedFaixas = [...precificacao.tabelaGlobal.faixas].sort((a, b) => a.min - b.min);
    return sortedFaixas[0]?.valor || regras.pacote?.valorFotoExtra || 0;
  }

  // Category model: check if should use fixed price
  if (precificacao.modelo === 'categoria') {
    if (precificacao.tabelaCategoria?.usar_valor_fixo_pacote) {
      return regras.pacote?.valorFotoExtra || 0;
    }
    if (precificacao.tabelaCategoria?.faixas?.length) {
      const sortedFaixas = [...precificacao.tabelaCategoria.faixas].sort((a, b) => a.min - b.min);
      return sortedFaixas[0]?.valor || regras.pacote?.valorFotoExtra || 0;
    }
  }

  // Fallback
  return regras.pacote?.valorFotoExtra || 0;
}

/**
 * Resolve o preço unitário e regras congeladas para criação assistida (com session_id).
 *
 * Regra de precedência (ordem de freshness):
 *   1. URL `preco_da_foto_extra` (gerada no clique de "Criar galeria" no Gestão — mais fresca)
 *   2. JSONB `regras.pacote.valorFotoExtra` (pode estar stale se o trigger falhar)
 *
 * Quando há divergência > R$ 0,01 e a URL traz valor válido (>0), a URL vence:
 * - patcheia o JSONB em memória para a galeria nascer já consistente,
 * - emite warning para telemetria de divergência (problemas no trigger / race conditions).
 */
export function resolveAssistedExtraPrice(
  regras: RegrasCongeladas | null,
  precoDaFotoExtraFromUrl: number | undefined
): { valor: number; regras: RegrasCongeladas | null } {
  if (!regras) {
    return { valor: precoDaFotoExtraFromUrl ? sanitizeExtraPrice(precoDaFotoExtraFromUrl) : 0, regras: null };
  }

  const valorJsonb = sanitizeExtraPrice(getInitialExtraPrice(regras));
  const valorUrl =
    precoDaFotoExtraFromUrl !== undefined && precoDaFotoExtraFromUrl > 0
      ? sanitizeExtraPrice(precoDaFotoExtraFromUrl)
      : undefined;

  const modelo = regras.precificacaoFotoExtra?.modelo;
  const allowUrlOverride = !modelo || modelo === 'fixo';

  if (allowUrlOverride && valorUrl !== undefined && Math.abs(valorUrl - valorJsonb) > 0.01) {
    console.warn(
      '[GalleryCreate] Divergência preco_da_foto_extra: URL=',
      valorUrl,
      'JSONB=',
      valorJsonb,
      '— usando URL (mais fresca)'
    );
    const patchedRegras: RegrasCongeladas = {
      ...regras,
      pacote: { ...regras.pacote, valorFotoExtra: valorUrl },
    };
    return { valor: valorUrl, regras: patchedRegras };
  }

  return { valor: valorJsonb, regras };
}
