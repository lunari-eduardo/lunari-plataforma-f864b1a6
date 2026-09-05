import {
  SaleMode,
  PricingModel,
  DiscountPackage,
  SaleSettings,
  ImageResizeOption,
  WatermarkType,
  WatermarkDisplay,
  TitleCaseMode,
} from '@/types/gallery';
import {
  RegrasCongeladas,
  getFaixasFromRegras,
  buildRegrasFromDiscountPackages,
} from '@/lib/pricingUtils';
import { resolveAssistedExtraPrice } from './pricingHelpers';

export interface ResolvePricingParams {
  regrasCongeladas: RegrasCongeladas | null;
  overridePricing: boolean;
  sessionId?: string | null;
  precoDaFotoExtraUrl?: number;
  saleMode: SaleMode;
  pricingModel: PricingModel;
  fixedPrice: number;
  discountPackages: DiscountPackage[];
  includedPhotos: number;
  packageName: string;
  allowExtraPhotos: boolean;
}

export function resolveFinalPricingAndRules(params: ResolvePricingParams): {
  valorFotoExtraFinal: number;
  finalRegrasCongeladas: RegrasCongeladas | null;
} {
  const hasSessionRegras = params.regrasCongeladas && !params.overridePricing;
  const hasSessionId = !!params.sessionId;
  let valorFotoExtraFinal = params.fixedPrice;
  let finalRegrasCongeladas: RegrasCongeladas | null = null;

  if (hasSessionRegras) {
    const resolved = resolveAssistedExtraPrice(
      params.regrasCongeladas,
      params.precoDaFotoExtraUrl
    );
    valorFotoExtraFinal =
      resolved.valor > 0 ? resolved.valor : params.fixedPrice > 0 ? params.fixedPrice : 0;
    finalRegrasCongeladas = resolved.regras;
  } else if (
    !hasSessionId &&
    params.saleMode !== 'no_sale' &&
    params.pricingModel === 'packages' &&
    params.discountPackages.length > 0
  ) {
    finalRegrasCongeladas = buildRegrasFromDiscountPackages(
      params.discountPackages,
      params.fixedPrice,
      params.includedPhotos,
      params.packageName
    );
    if (finalRegrasCongeladas.precificacaoFotoExtra?.tabelaGlobal?.faixas?.length) {
      const sortedFaixas = [
        ...finalRegrasCongeladas.precificacaoFotoExtra.tabelaGlobal.faixas,
      ].sort((a, b) => a.min - b.min);
      valorFotoExtraFinal = sortedFaixas[0]?.valor || params.fixedPrice;
    }
  }

  if (params.saleMode !== 'no_sale' && params.allowExtraPhotos && valorFotoExtraFinal <= 0) {
    const faixas = getFaixasFromRegras(finalRegrasCongeladas || params.regrasCongeladas);
    if (faixas.length > 0) {
      valorFotoExtraFinal = faixas[0]?.valor || 0;
    }
  }

  return { valorFotoExtraFinal, finalRegrasCongeladas };
}

export interface BuildGalleryConfigParams {
  watermarkType: WatermarkType;
  watermarkOpacity: number;
  watermarkDisplay: WatermarkDisplay;
  imageResizeOption: ImageResizeOption;
  allowComments: boolean;
  allowDownload: boolean;
  allowExtraPhotos: boolean;
  saleSettings: SaleSettings;
  themeId?: string;
  clientMode: 'light' | 'dark';
  sessionFont: string;
  titleCaseMode: TitleCaseMode;
}

export function buildGalleryConfig(params: BuildGalleryConfigParams) {
  return {
    watermark: {
      type: params.watermarkType,
      opacity: params.watermarkOpacity,
      position: 'center',
    },
    watermarkDisplay: params.watermarkDisplay,
    imageResizeOption: params.imageResizeOption,
    allowComments: params.allowComments,
    allowDownload: params.allowDownload,
    allowExtraPhotos: params.allowExtraPhotos,
    saleSettings: params.saleSettings,
    themeId: params.themeId,
    clientMode: params.clientMode,
    sessionFont: params.sessionFont,
    titleCaseMode: params.titleCaseMode,
  };
}
