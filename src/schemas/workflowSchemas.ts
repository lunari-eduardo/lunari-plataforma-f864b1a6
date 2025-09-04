/**
 * Schemas Zod para validação de dados do workflow
 */

import { z } from 'zod';

// Schema para Produto Workflow
export const ProdutoWorkflowSchema = z.object({
  nome: z.string(),
  quantidade: z.number().min(0),
  valorUnitario: z.number().min(0),
  tipo: z.enum(['incluso', 'manual']),
  produzido: z.boolean().optional(),
  entregue: z.boolean().optional()
});

// Schema para Pagamento
export const PagamentoSchema = z.object({
  id: z.string(),
  valor: z.number().positive(),
  data: z.string()
});

// Schema para WorkflowItem
export const WorkflowItemSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  data: z.string(),
  hora: z.string(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  whatsapp: z.string(),
  email: z.string().email().optional().or(z.literal('')),
  descricao: z.string(),
  status: z.string(),
  categoria: z.string(),
  pacote: z.string(),
  valorPacote: z.number().min(0),
  desconto: z.number().min(0),
  valorFotoExtra: z.number().min(0),
  qtdFotoExtra: z.number().min(0),
  valorTotalFotoExtra: z.number().min(0),
  produto: z.string(),
  qtdProduto: z.number().min(0),
  valorTotalProduto: z.number().min(0),
  produtosList: z.array(ProdutoWorkflowSchema).optional(),
  valorAdicional: z.number().min(0),
  detalhes: z.string(),
  total: z.number().min(0),
  valorPago: z.number().min(0),
  restante: z.number(),
  pagamentos: z.array(PagamentoSchema),
  fonte: z.enum(['agenda', 'orcamento']),
  dataOriginal: z.date().or(z.string()),
  valorFinalAjustado: z.boolean().optional(),
  valorOriginalOrcamento: z.number().optional(),
  percentualAjusteOrcamento: z.number().optional(),
  clienteId: z.string().optional()
});

export type WorkflowItemValidated = z.infer<typeof WorkflowItemSchema>;
export type ProdutoWorkflowValidated = z.infer<typeof ProdutoWorkflowSchema>;
export type PagamentoValidated = z.infer<typeof PagamentoSchema>;