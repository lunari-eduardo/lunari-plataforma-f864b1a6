/**
 * Schemas Zod para validação de dados de configuração
 */

import { z } from 'zod';

// Schema para Categoria
export const CategoriaSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  cor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Cor deve estar no formato hexadecimal'),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().optional()
});

// Schema para Produto
export const ProdutoSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  categoria: z.string(),
  custo: z.number().min(0),
  valorVenda: z.number().min(0),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  descricao: z.string().optional(),
  margem: z.number().optional(),
  unidade: z.string().optional()
});

// Schema para Pacote
export const PacoteSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  categoria: z.string(),
  valor: z.number().min(0),
  valorFotoExtra: z.number().min(0),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  descricao: z.string().optional(),
  inclusos: z.array(z.string()).optional(),
  tempoEstimado: z.number().optional()
});

// Schema para Etapa de Trabalho
export const EtapaTrabalhoSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional(),
  cor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Cor deve estar no formato hexadecimal'),
  ordem: z.number().min(0),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().optional()
});

export type CategoriaValidated = z.infer<typeof CategoriaSchema>;
export type ProdutoValidated = z.infer<typeof ProdutoSchema>;
export type PacoteValidated = z.infer<typeof PacoteSchema>;
export type EtapaTrabalhoValidated = z.infer<typeof EtapaTrabalhoSchema>;