/**
 * TESTE PARA VERIFICAR CORREÇÃO DO CÁLCULO DE CARTÃO DE CRÉDITO
 * Deve ser removido após validação
 */

import { FinancialEngine, CreditCard } from '@/services/FinancialEngine';

// Teste específico para o cenário relatado
export function testCreditCardCalculation() {
  console.log('🧪 TESTE: Calculando parcelas de cartão de crédito...');
  
  // Cenário exato do problema
  const cartaoTeste: CreditCard = {
    id: 'test_card',
    nome: 'Cartão Teste',
    diaVencimento: 5,
    diaFechamento: 28,
    userId: 'user1',
    ativo: true,
    criadoEm: '2025-07-29'
  };
  
  // Salvar cartão temporariamente
  const cartoes = FinancialEngine.loadCreditCards();
  FinancialEngine.saveCreditCards([cartaoTeste]);
  
  // Dados do lançamento
  const dadosLancamento = {
    valorTotal: 1000,
    dataPrimeiraOcorrencia: '2025-07-29', // 29/07 (após fechamento dia 28)
    itemId: 'test_item',
    isRecorrente: false,
    isParcelado: true,
    numeroDeParcelas: 10,
    observacoes: 'Teste de parcelamento',
    cartaoCreditoId: 'test_card'
  };
  
  console.log('📋 Dados do teste:', dadosLancamento);
  console.log('💳 Cartão:', cartaoTeste);
  
  try {
    const resultado = FinancialEngine.createTransactions(dadosLancamento);
    
    console.log('✅ Resultado do teste:');
    console.log(`   Total de parcelas: ${resultado.transactions.length}`);
    
    resultado.transactions.forEach((transacao, index) => {
      console.log(`   Parcela ${index + 1}: ${transacao.dataVencimento} - R$ ${transacao.valor.toFixed(2)}`);
    });
    
    // Verificações específicas para compra 29/07 (após fechamento 28/07)
    const primeiraParcela = resultado.transactions[0];
    console.log(`🔍 Primeira parcela: ${primeiraParcela.dataVencimento}`);
    console.log(`   Esperado: 2025-09-05 (setembro - fatura de agosto)`);
    console.log(`   Correto: ${primeiraParcela.dataVencimento === '2025-09-05' ? '✅' : '❌'}`);
    
    const segundaParcela = resultado.transactions[1];
    console.log(`🔍 Segunda parcela: ${segundaParcela.dataVencimento}`);
    console.log(`   Esperado: 2025-10-05 (outubro)`);
    console.log(`   Correto: ${segundaParcela.dataVencimento === '2025-10-05' ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    // Restaurar cartões originais
    localStorage.setItem('lunari_fin_credit_cards', JSON.stringify(cartoes));
  }
}

// Executar teste automaticamente quando importado
if (typeof window !== 'undefined') {
  // Aguardar um pouco para não interferir com inicialização
  setTimeout(testCreditCardCalculation, 1000);
}