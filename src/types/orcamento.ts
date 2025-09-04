import { Cliente } from './cliente';

// Mantido apenas para compatibilidade com arquivos que ainda referenciam Orcamento
// Este tipo será removido após a migração completa
export interface Orcamento {
  id: string;
  sessionId?: string;
  cliente: Cliente;
  data: string;
  hora: string;
  categoria: string;
  descricao?: string;
  detalhes: string;
  valorFinal: number;
  desconto: number;
  descontoTipo?: 'valor' | 'percentual';
  validade?: string;
  status: 'pendente' | 'enviado' | 'followup' | 'fechado' | 'perdido';
  origemCliente: string;
  criadoEm: string;
  valorTotal?: number;
}