/**
 * MIGRAÇÃO AUTOMÁTICA PARA TRANSAÇÕES DE CARTÃO DE CRÉDITO
 * 
 * Esta função deve ser executada uma vez para adicionar o campo dataCompra
 * em todas as transações de cartão existentes que não possuem este campo.
 */

import { FinancialEngine } from '@/services/FinancialEngine';

export function runCreditCardDataMigration(): void {
  try {
    console.log('Iniciando migração de dados de cartão de crédito...');
    
    // Executar migração
    FinancialEngine.migrateExistingCreditCardTransactions();
    
    console.log('Migração de dados de cartão de crédito concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante migração de dados de cartão:', error);
  }
}

// Auto-executar migração se necessário
export function autoMigrateCreditCardData(): void {
  const transactions = FinancialEngine.loadTransactions();
  const needsMigration = transactions.some(t => 
    t.cartaoCreditoId && !t.dataCompra
  );
  
  if (needsMigration) {
    console.log('Detectada necessidade de migração automática de dados de cartão');
    runCreditCardDataMigration();
  }
}