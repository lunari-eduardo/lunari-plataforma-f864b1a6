import { ORIGENS_PADRAO, type OrigemPadrao } from './defaultOrigens';

/**
 * Utility functions for handling origin normalization and display
 */

/**
 * Normalizes an origin value to a standard ID format
 * If the value is a name, converts it to the corresponding ID
 * If the value is already an ID, returns it as-is
 */
export function normalizeOriginToId(origem: string | undefined): string | undefined {
  if (!origem) return undefined;

  // If it's already an ID (exists in ORIGENS_PADRAO), return it
  const existingById = ORIGENS_PADRAO.find(o => o.id === origem);
  if (existingById) return origem;

  // If it's a name, find the corresponding ID
  const existingByName = ORIGENS_PADRAO.find(o => o.nome === origem);
  if (existingByName) return existingByName.id;

  // If not found, return the original value (could be a custom origin)
  return origem;
}

/**
 * Gets the display name for an origin ID
 */
export function getOriginDisplayName(origemId: string | undefined): string {
  if (!origemId) return 'Não informado';
  
  const origem = ORIGENS_PADRAO.find(o => o.id === origemId);
  return origem?.nome || origemId;
}

/**
 * Gets the full origin info (name, color, id) for an origin ID
 */
export function getOriginInfo(origemId: string | undefined): OrigemPadrao | null {
  if (!origemId) return null;
  
  return ORIGENS_PADRAO.find(o => o.id === origemId) || null;
}

/**
 * Migrates existing clients with origin names to origin IDs
 */
export function migrateClientOrigins(clientes: any[]): any[] {
  console.log('🔄 [OriginUtils] Iniciando migração de origens dos clientes...');
  
  const migratedClientes = clientes.map(cliente => {
    if (!cliente.origem) return cliente;
    
    const normalizedOrigin = normalizeOriginToId(cliente.origem);
    
    if (normalizedOrigin !== cliente.origem) {
      console.log(`📝 [OriginUtils] Migrando cliente ${cliente.nome}: "${cliente.origem}" → "${normalizedOrigin}"`);
      return {
        ...cliente,
        origem: normalizedOrigin
      };
    }
    
    return cliente;
  });
  
  const migratedCount = migratedClientes.filter((cliente, idx) => 
    cliente.origem !== clientes[idx].origem
  ).length;
  
  console.log(`✅ [OriginUtils] Migração concluída: ${migratedCount} clientes migrados`);
  
  return migratedClientes;
}