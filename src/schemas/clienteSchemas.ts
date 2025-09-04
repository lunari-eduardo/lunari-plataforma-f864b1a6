/**
 * Schemas Zod para validação de dados de clientes
 */

import { z } from 'zod';

// Schema para Cliente
export const ClienteSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  whatsapp: z.string(),
  email: z.string().email().optional().or(z.literal('')),
  origem: z.string(),
  endereco: z.string().optional(),
  observacoes: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  // Campos específicos do sistema
  origemId: z.string().optional(),
  instagram: z.string().optional(),
  telefone: z.string().optional(),
  cpf: z.string().optional(),
  aniversario: z.string().optional(),
  cep: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  bairro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional()
});

// Schema para Origem do Cliente
export const OrigemClienteSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  cor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Cor deve estar no formato hexadecimal'),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().optional()
});

export type ClienteValidated = z.infer<typeof ClienteSchema>;
export type OrigemClienteValidated = z.infer<typeof OrigemClienteSchema>;