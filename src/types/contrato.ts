export type ContratoStatus = 'rascunho' | 'enviado' | 'assinado' | 'cancelado';

export interface ContratoTemplate {
  id: string;
  user_id: string;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  conteudo: string;
  is_padrao: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContratoSigner {
  nome?: string;
  email?: string;
  documento?: string;
  papel?: string;
}

export interface Contrato {
  id: string;
  user_id: string;
  cliente_id: string;
  session_id?: string | null;
  template_id?: string | null;

  titulo: string;
  conteudo: string;
  variaveis_snapshot?: Record<string, any> | null;

  status: ContratoStatus;

  arquivo_assinado_path?: string | null;
  arquivo_assinado_nome?: string | null;
  arquivo_assinado_tamanho?: number | null;

  signature_provider?: string | null;
  signature_external_id?: string | null;
  signers?: ContratoSigner[] | null;

  enviado_em?: string | null;
  assinado_em?: string | null;
  observacoes?: string | null;

  created_at: string;
  updated_at: string;

  // Joins opcionais
  cliente?: { id: string; nome: string; email?: string | null } | null;
  template?: { id: string; nome: string } | null;
}

export interface ContratoCreateInput {
  cliente_id: string;
  session_id?: string | null;
  template_id?: string | null;
  titulo: string;
  conteudo: string;
  variaveis_snapshot?: Record<string, any>;
  observacoes?: string;
}

export interface ContratoTemplateCreateInput {
  nome: string;
  descricao?: string;
  categoria?: string;
  conteudo: string;
  is_padrao?: boolean;
}

export const CONTRATO_STATUS_LABELS: Record<ContratoStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  assinado: 'Assinado',
  cancelado: 'Cancelado',
};
