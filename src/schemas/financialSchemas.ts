/**
 * Schemas Zod para validação de dados financeiros
 */

import { z } from 'zod';
import { GrupoPrincipal, StatusTransacao } from '@/types/financas';

// Schema para Item Financeiro
export const ItemFinanceiroSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  grupo_principal: z.enum(['Despesa Fixa', 'Despesa Variável', 'Investimento', 'Receita Não Operacional', 'Receita Operacional']),
  grupoPrincipal: z.enum(['Despesa Fixa', 'Despesa Variável', 'Investimento', 'Receita Não Operacional', 'Receita Operacional']).optional(),
  userId: z.string(),
  ativo: z.boolean(),
  criadoEm: z.string()
});

// Schema para Transação
export const TransacaoSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  valor: z.number().positive('Valor deve ser positivo'),
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  status: z.enum(['Agendado', 'Faturado', 'Pago', 'Pendente']),
  observacoes: z.string().optional(),
  userId: z.string(),
  criadoEm: z.string(),
  blueprintId: z.string().optional(),
});

// Schema para Cartão de Crédito
export const CartaoSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  diaVencimento: z.number().min(1).max(31),
  diaFechamento: z.number().min(1).max(31),
  ativo: z.boolean()
});

export type ItemFinanceiroValidated = z.infer<typeof ItemFinanceiroSchema>;
export type TransacaoValidated = z.infer<typeof TransacaoSchema>;
export type CartaoValidated = z.infer<typeof CartaoSchema>;