/**
 * Contrato compartilhado Gestão ↔ Gallery para a coluna `cobrancas.finalidade`.
 *
 * Mantém em um único lugar os valores aceitos pelo banco e a forma como
 * passamos a "intenção" da cobrança até o INSERT final.
 *
 * Regras:
 * - `sessao` (default DB) → cobrança da sessão / pacote / parcela / avulsa.
 *   `galeria_id` e `qtd_fotos` ficam nulos.
 * - `fotos_extras` → cobrança de fotos extras vinculada a uma galeria existente.
 *   `galeria_id` e `qtd_fotos > 0` são OBRIGATÓRIOS. O trigger
 *   `sync_gallery_on_cobranca_paid` no Gallery só dispara nesses casos.
 */

export const COBRANCA_FINALIDADE = {
  SESSAO: 'sessao',
  FOTOS_EXTRAS: 'fotos_extras',
} as const;

export type CobrancaFinalidade =
  typeof COBRANCA_FINALIDADE[keyof typeof COBRANCA_FINALIDADE];

export interface CobrancaSessaoBinding {
  finalidade: 'sessao';
}

export interface CobrancaExtrasBinding {
  finalidade: 'fotos_extras';
  galeriaId: string;
  qtdFotos: number;
  snapshotFotosIncluidas?: number | null;
}

export type CobrancaBinding = CobrancaSessaoBinding | CobrancaExtrasBinding;

export function isExtrasBinding(
  binding: CobrancaBinding | undefined | null
): binding is CobrancaExtrasBinding {
  return !!binding && binding.finalidade === 'fotos_extras';
}

/** Converte o binding em payload pronto para insert (snake_case). */
export function bindingToCobrancaColumns(binding?: CobrancaBinding | null): {
  finalidade: CobrancaFinalidade;
  galeria_id: string | null;
  qtd_fotos: number | null;
  snapshot_fotos_incluidas: number | null;
} {
  if (isExtrasBinding(binding)) {
    return {
      finalidade: 'fotos_extras',
      galeria_id: binding.galeriaId,
      qtd_fotos: binding.qtdFotos,
      snapshot_fotos_incluidas: binding.snapshotFotosIncluidas ?? null,
    };
  }
  return {
    finalidade: 'sessao',
    galeria_id: null,
    qtd_fotos: null,
    snapshot_fotos_incluidas: null,
  };
}
