import { Cliente } from '@/types/orcamentos';
import { WorkflowItem } from '@/contexts/AppContext';

export const createTestClient = (): Cliente => ({
  id: `test-${Date.now()}`,
  nome: 'Eduardo Diehl',
  email: 'eduardo@teste.com',
  telefone: '+55 (11) 98765-4321'
});

export const createTestWorkflowItem = (clienteId: string): WorkflowItem => ({
  id: `test-workflow-${Date.now()}`,
  clienteId: clienteId,
  data: new Date().toLocaleDateString('pt-BR'),
  hora: '14:00',
  nome: 'Eduardo Diehl',
  whatsapp: '+55 (11) 98765-4321',
  email: 'eduardo@teste.com',
  descricao: 'Sessão de teste',
  status: 'Confirmado',
  categoria: 'Família',
  pacote: 'Básico',
  valorPacote: 450,
  desconto: 0,
  valorFotoExtra: 25,
  qtdFotoExtra: 0,
  valorTotalFotoExtra: 0,
  produto: 'Álbum 20x30 (incluso)',
  qtdProduto: 1,
  valorTotalProduto: 0,
  valorAdicional: 0,
  detalhes: 'Teste de integração CRM',
  total: 450,
  valorPago: 200,
  restante: 250,
  pagamentos: [{
    id: 'pay-1',
    valor: 200,
    data: new Date().toLocaleDateString('pt-BR')
  }],
  fonte: 'agenda',
  dataOriginal: new Date()
});