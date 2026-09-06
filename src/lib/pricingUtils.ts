/**
 * Progressive Pricing Utilities
 * Handles discount tiers for extra photos based on frozen rules from Gestão.
 *
 * Refatorado: Fachada modular re-exportando submódulos especializados (< 500 linhas).
 */

export * from './pricing/types';
export * from './pricing/sanitization';
export * from './pricing/tierLookup';
export * from './pricing/progressiveCalculation';
export * from './pricing/packageConversion';
