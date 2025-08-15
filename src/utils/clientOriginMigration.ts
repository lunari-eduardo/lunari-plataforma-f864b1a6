import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { migrateClientOrigins } from '@/utils/originUtils';

/**
 * One-time migration utility to fix existing client origins from names to IDs
 */
export function runClientOriginMigration() {
  const MIGRATION_KEY = 'client_origin_migration_completed';
  
  // Check if migration has already been run
  if (localStorage.getItem(MIGRATION_KEY)) {
    console.log('🔄 [Migration] Client origin migration already completed, skipping...');
    return;
  }
  
  console.log('🚀 [Migration] Starting client origin migration...');
  
  try {
    // Get current clients using the correct storage method and key
    const clientes = storage.load(STORAGE_KEYS.CLIENTS, []);
    console.log(`📊 [Migration] Found ${clientes.length} clients to migrate`);
    
    // Migrate origins
    const migratedClientes = migrateClientOrigins(clientes);
    
    // Save migrated clients using the correct storage method and key
    storage.save(STORAGE_KEYS.CLIENTS, migratedClientes);
    
    // Mark migration as completed
    localStorage.setItem(MIGRATION_KEY, 'true');
    
    console.log('✅ [Migration] Client origin migration completed successfully');
  } catch (error) {
    console.error('❌ [Migration] Error during client origin migration:', error);
  }
}