/**
 * Payment Settings Utility
 * 
 * Manages unified payment settings in `dados_extras` JSON across the entire Lunari platform.
 */

type MigratableFields = Record<string, any>;

/**
 * Resolves unified settings from dados_extras, seamlessly reading root fields
 * while maintaining backward compatibility with legacy sub-objects if present.
 */
export function getUnifiedPaymentSettings<T extends MigratableFields>(dadosExtras: any): T {
  if (!dadosExtras || typeof dadosExtras !== 'object') return {} as T;

  const root = { ...dadosExtras };
  const legacyGestao = typeof dadosExtras.gestao_settings === 'object' ? dadosExtras.gestao_settings : {};
  const legacyGallery = typeof dadosExtras.gallery_settings === 'object' ? dadosExtras.gallery_settings : {};

  // Clean sub-keys from root
  delete root.gestao_settings;
  delete root.gallery_settings;

  // Merge legacy nested settings into root if root doesn't have them
  return {
    ...legacyGallery,
    ...legacyGestao,
    ...root,
  } as T;
}

/**
 * Saves unified settings directly into dados_extras.
 */
export function setUnifiedPaymentSettings(
  dadosExtras: any,
  settings: MigratableFields
): any {
  const result = { ...(dadosExtras || {}) };
  // Remove legacy separated keys
  delete result.gestao_settings;
  delete result.gallery_settings;

  // Write unified settings at root
  return {
    ...result,
    ...settings,
  };
}

/** Backward compatibility helper aliases */
export const getContextSettings = <T extends MigratableFields>(dadosExtras: any, _context?: string): T =>
  getUnifiedPaymentSettings<T>(dadosExtras);

export const setContextSettings = (
  dadosExtras: any,
  _context: string,
  settings: MigratableFields,
  _provider?: 'asaas' | 'mercadopago'
): any => setUnifiedPaymentSettings(dadosExtras, settings);

