/**
 * Pricing Services - Centralized Export
 * Clean architecture for pricing system
 */

// Adapter Pattern
export { type PricingStorageAdapter, type StorageConfig } from './PricingStorageAdapter';
export { LocalPricingAdapter } from './LocalPricingAdapter';
export { SupabasePricingAdapter } from './SupabasePricingAdapter';

// Migration
export { PricingMigrationToSupabase } from './PricingMigrationToSupabase';

// Specialized Services
export { EstruturaCustosService } from './EstruturaCustosService';
export { CalculadoraService } from './CalculadoraService';
export { MetasService } from './MetasService';
export { PricingValidationService } from './PricingValidationService';
export { PricingBackupService } from './PricingBackupService';

// Imports for factory
import type { PricingStorageAdapter, StorageConfig } from './PricingStorageAdapter';
import { LocalPricingAdapter } from './LocalPricingAdapter';
import { SupabasePricingAdapter } from './SupabasePricingAdapter';
import { EstruturaCustosService } from './EstruturaCustosService';
import { CalculadoraService } from './CalculadoraService';
import { MetasService } from './MetasService';
import { PricingValidationService } from './PricingValidationService';
import { PricingBackupService } from './PricingBackupService';

// Factory Pattern for creating services
export class PricingServiceFactory {
  static createServices(adapter: PricingStorageAdapter) {
    return {
      estruturaCustos: new EstruturaCustosService(adapter),
      calculadora: new CalculadoraService(adapter),
      metas: new MetasService(adapter),
      validation: new PricingValidationService(adapter),
      backup: new PricingBackupService(adapter)
    };
  }

  static createLocalServices() {
    const adapter = new LocalPricingAdapter();
    return this.createServices(adapter);
  }

  static createSupabaseServices(config?: StorageConfig) {
    const adapter = new SupabasePricingAdapter(config);
    return this.createServices(adapter);
  }
}