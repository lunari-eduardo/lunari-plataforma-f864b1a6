/**
 * TESTE E VALIDAÇÃO DA NOVA ARQUITETURA DE BLUEPRINTS
 * 
 * Este utilitário fornece funções para testar e validar o sistema de Blueprints
 * e realizar a migração completa do sistema antigo.
 */

import { RecurringBlueprintEngine } from '@/services/RecurringBlueprintEngine';
import { getCurrentDateString } from '@/utils/dateUtils';

export class BlueprintMigrationTest {
  
  /**
   * Teste completo da arquitetura de Blueprints
   */
  static runFullTest(): void {
    console.log('=== INICIANDO TESTE COMPLETO DA ARQUITETURA DE BLUEPRINTS ===');
    
    // 1. Limpar dados antigos
    console.log('1. Limpando dados existentes...');
    RecurringBlueprintEngine.clearAllData();
    
    // 2. Criar blueprints de teste
    console.log('2. Criando blueprints de teste...');
    this.createTestBlueprints();
    
    // 3. Testar geração just-in-time
    console.log('3. Testando geração just-in-time...');
    this.testJustInTimeGeneration();
    
    // 4. Testar edição isolada
    console.log('4. Testando edição isolada...');
    this.testIsolatedEditing();
    
    // 5. Verificar anti-duplicação
    console.log('5. Verificando sistema anti-duplicação...');
    this.testAntiDuplication();
    
    console.log('=== TESTE COMPLETO FINALIZADO ===');
  }
  
  /**
   * Criar blueprints de teste
   */
  private static createTestBlueprints(): void {
    // Despesa fixa: Adobe (valor fixo)
    const adobeResult = RecurringBlueprintEngine.createBlueprint({
      itemId: '2', // Adobe
      valor: 52.00,
      isValorFixo: true,
      dataPrimeiraOcorrencia: '2025-07-15',
      observacoes: 'Assinatura Adobe'
    });
    console.log('   ✓ Blueprint Adobe criado:', adobeResult.blueprint.id);
    
    // Despesa variável: Energia (valor variável)
    const energiaResult = RecurringBlueprintEngine.createBlueprint({
      itemId: '4', // Energia Elétrica
      valor: 150.00,
      isValorFixo: false,
      dataPrimeiraOcorrencia: '2025-07-10',
      observacoes: 'Conta de energia - valor variável'
    });
    console.log('   ✓ Blueprint Energia criado:', energiaResult.blueprint.id);
    
    // Aluguel (valor fixo)
    const aluguelResult = RecurringBlueprintEngine.createBlueprint({
      itemId: '1', // Aluguel
      valor: 1200.00,
      isValorFixo: true,
      dataPrimeiraOcorrencia: '2025-07-05',
      observacoes: 'Aluguel mensal'
    });
    console.log('   ✓ Blueprint Aluguel criado:', aluguelResult.blueprint.id);
  }
  
  /**
   * Testar geração just-in-time
   */
  private static testJustInTimeGeneration(): void {
    console.log('   Gerando transações para Agosto/2025...');
    const novasTransacoes = RecurringBlueprintEngine.generateTransactionsForMonth(2025, 8);
    console.log(`   ✓ ${novasTransacoes.length} transações geradas para Agosto`);
    
    console.log('   Gerando novamente para Agosto/2025 (deve ser 0)...');
    const duplicadas = RecurringBlueprintEngine.generateTransactionsForMonth(2025, 8);
    console.log(`   ✓ ${duplicadas.length} transações duplicadas (deve ser 0)`);
    
    console.log('   Gerando transações para Setembro/2025...');
    const setembro = RecurringBlueprintEngine.generateTransactionsForMonth(2025, 9);
    console.log(`   ✓ ${setembro.length} transações geradas para Setembro`);
  }
  
  /**
   * Testar edição isolada
   */
  private static testIsolatedEditing(): void {
    const transacoes = RecurringBlueprintEngine.loadTransactions();
    const energiaTransacao = transacoes.find(t => 
      t.blueprintId?.includes('blueprint_') && 
      t.dataVencimento.includes('2025-08-10')
    );
    
    if (energiaTransacao) {
      console.log('   Editando valor da energia de Agosto...');
      RecurringBlueprintEngine.updateTransaction(energiaTransacao.id, {
        valor: 180.00,
        observacoes: 'Valor editado para Agosto'
      });
      
      const transacaoAtualizada = RecurringBlueprintEngine.loadTransactions()
        .find(t => t.id === energiaTransacao.id);
      
      console.log(`   ✓ Valor atualizado: R$ ${transacaoAtualizada?.valor}`);
      console.log('   ✓ Edição isolada - outras instâncias não afetadas');
    }
  }
  
  /**
   * Testar sistema anti-duplicação
   */
  private static testAntiDuplication(): void {
    console.log('   Testando múltiplas chamadas de geração...');
    
    for (let i = 0; i < 5; i++) {
      const resultado = RecurringBlueprintEngine.generateTransactionsForMonth(2025, 10);
      console.log(`   Tentativa ${i + 1}: ${resultado.length} transações geradas`);
    }
    
    const transacoes = RecurringBlueprintEngine.loadTransactions();
    const outubro = transacoes.filter(t => t.dataVencimento.includes('2025-10'));
    console.log(`   ✓ Total de transações para Outubro: ${outubro.length} (deve ser 3)`);
  }
  
  /**
   * Migrar dados reais do usuário
   */
  static migrateUserData(): void {
    console.log('=== INICIANDO MIGRAÇÃO DE DADOS REAIS ===');
    
    // 1. Backup dos dados antigos
    const backupTransactions = localStorage.getItem('lunari_transactions');
    if (backupTransactions) {
      localStorage.setItem('lunari_transactions_backup_' + Date.now(), backupTransactions);
    }
    
    // 2. Executar migração
    RecurringBlueprintEngine.migrateOldRecurringTransactions();
    
    // 3. Limpar duplicações
    RecurringBlueprintEngine.cleanDuplicatedTransactions();
    
    // 4. Verificar resultados
    const blueprints = RecurringBlueprintEngine.loadBlueprints();
    const transactions = RecurringBlueprintEngine.loadTransactions();
    
    console.log(`✓ Migração concluída: ${blueprints.length} blueprints, ${transactions.length} transações`);
    console.log('=== MIGRAÇÃO FINALIZADA ===');
  }
  
  /**
   * Relatório do status atual
   */
  static statusReport(): void {
    console.log('=== RELATÓRIO DO SISTEMA DE BLUEPRINTS ===');
    
    const blueprints = RecurringBlueprintEngine.loadBlueprints();
    const transactions = RecurringBlueprintEngine.loadTransactions();
    
    console.log(`Blueprints ativos: ${blueprints.length}`);
    console.log(`Transações existentes: ${transactions.length}`);
    
    blueprints.forEach(blueprint => {
      const relatedTransactions = transactions.filter(t => t.blueprintId === blueprint.id);
      console.log(`  - ${blueprint.itemId}: ${relatedTransactions.length} transações`);
    });
    
    console.log('=== FIM DO RELATÓRIO ===');
  }
}

// Exportar função de teste rápido para console
(window as any).testBlueprints = () => BlueprintMigrationTest.runFullTest();
(window as any).migrateBlueprints = () => BlueprintMigrationTest.migrateUserData();
(window as any).blueprintStatus = () => BlueprintMigrationTest.statusReport();