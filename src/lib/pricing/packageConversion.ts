import type { DiscountPackage } from "@/types/gallery";
import type { FaixaPreco, RegrasCongeladas } from "./types";
import { sanitizeExtraPrice } from "./sanitization";
import { getFaixasFromRegras } from "./tierLookup";

/**
 * Builds RegrasCongeladas from standalone discount packages
 * Used when photographer configures progressive pricing without Gestão integration
 *
 * This function transforms the UI-friendly DiscountPackage[] format into the
 * standard RegrasCongeladas format used by the pricing engine.
 *
 * @param discountPackages - Array of discount packages from the UI
 * @param fixedPrice - Base price per extra photo (used for savings calculation)
 * @param includedPhotos - Number of photos included in the package
 * @param packageName - Optional package name for display
 * @returns RegrasCongeladas object ready to be saved to the database
 */
export function buildRegrasFromDiscountPackages(
  discountPackages: DiscountPackage[],
  fixedPrice: number,
  includedPhotos: number,
  packageName?: string,
): RegrasCongeladas {
  // If no packages or using fixed pricing, return simple fixed rules
  if (!discountPackages || discountPackages.length === 0) {
    return {
      modelo: "fixo",
      dataCongelamento: new Date().toISOString(),
      pacote: {
        nome: packageName || "Pacote Manual",
        fotosIncluidas: includedPhotos,
        valorFotoExtra: fixedPrice,
      },
      precificacaoFotoExtra: {
        modelo: "fixo",
        valorFixo: fixedPrice,
      },
    };
  }

  // Transform discountPackages to faixas format
  const faixas: FaixaPreco[] = discountPackages.map((pkg) => ({
    min: pkg.minPhotos,
    max: pkg.maxPhotos, // Already null for infinity
    valor: pkg.pricePerPhoto,
  }));

  return {
    modelo: "global", // Use global model for standalone packages
    dataCongelamento: new Date().toISOString(),
    pacote: {
      nome: packageName || "Pacote Manual",
      fotosIncluidas: includedPhotos,
      valorFotoExtra: fixedPrice, // Base price for savings calculation
    },
    precificacaoFotoExtra: {
      modelo: "global",
      tabelaGlobal: {
        faixas,
      },
    },
  };
}

/**
 * Inverso de `buildRegrasFromDiscountPackages`: extrai a tabela de faixas
 * (DiscountPackage[]) a partir de um `RegrasCongeladas` salvo. Usado pelo
 * GalleryEdit para hidratar o editor de faixas a partir do JSONB existente.
 *
 * Retorna [] quando o modelo é fixo ou não há faixas definidas.
 */
export function discountPackagesFromRegras(
  regras: RegrasCongeladas | null | undefined,
): DiscountPackage[] {
  const faixas = getFaixasFromRegras(regras);
  if (!faixas.length) return [];
  return [...faixas]
    .sort((a, b) => a.min - b.min)
    .map((f, idx) => ({
      id: `faixa-${idx}-${f.min}`,
      minPhotos: f.min,
      maxPhotos: f.max,
      pricePerPhoto: sanitizeExtraPrice(f.valor),
    }));
}
