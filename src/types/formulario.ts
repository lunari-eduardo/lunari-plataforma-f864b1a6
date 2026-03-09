// Tipos para o Sistema de Formulários Inteligentes

export type FormularioCampoTipo = 
  | 'texto_curto'
  | 'texto_longo'
  | 'multipla_escolha'
  | 'selecao_unica'
  | 'data'
  | 'upload_imagem'
  | 'upload_referencia'
  | 'selecao_cores';

export interface FormularioCampo {
  id: string;
  tipo: FormularioCampoTipo;
  label: string;
  placeholder?: string;
  ordem: number;
  obrigatorio: boolean;
  opcoes?: string[];
  descricao?: string;
}

export interface FormularioTemplate {
  id: string;
  user_id: string | null;
  nome: string;
  categoria: 'gestante' | 'newborn' | 'familia' | 'casamento' | 'geral';
  descricao: string | null;
  campos: FormularioCampo[];
  is_system: boolean;
  tempo_estimado: number;
  created_at: string;
  updated_at: string;
}

export type FormularioStatus = 'rascunho' | 'publicado' | 'arquivado';
export type FormularioStatusEnvio = 'nao_enviado' | 'enviado' | 'respondido' | 'expirado';

export interface Formulario {
  id: string;
  user_id: string;
  template_id: string | null;
  titulo: string;
  titulo_cliente: string | null;
  descricao: string | null;
  campos: FormularioCampo[];
  mensagem_conclusao: string;
  tempo_estimado: number;
  cliente_id: string | null;
  session_id: string | null;
  status: FormularioStatus;
  status_envio: FormularioStatusEnvio;
  enviado_em: string | null;
  respondido_em: string | null;
  public_token: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  cliente?: {
    id: string;
    nome: string;
  };
}

export interface FormularioResposta {
  id: string;
  formulario_id: string;
  user_id: string;
  respondente_nome: string | null;
  respondente_email: string | null;
  respostas: Record<string, any>;
  submitted_at: string;
  created_at: string;
}

export interface FormularioCreateInput {
  titulo: string;
  titulo_cliente?: string;
  descricao?: string;
  campos: FormularioCampo[];
  mensagem_conclusao?: string;
  tempo_estimado?: number;
  template_id?: string;
  cliente_id?: string;
  session_id?: string;
}

export interface FormularioTemplateCreateInput {
  nome: string;
  categoria: FormularioTemplate['categoria'];
  descricao?: string;
  campos: FormularioCampo[];
  tempo_estimado?: number;
}

// Labels para exibição
export const CAMPO_TIPO_LABELS: Record<FormularioCampoTipo, string> = {
  texto_curto: 'Texto curto',
  texto_longo: 'Texto longo',
  multipla_escolha: 'Múltipla escolha',
  selecao_unica: 'Seleção única',
  data: 'Data',
  upload_imagem: 'Upload de imagem',
  upload_referencia: 'Referências visuais',
  selecao_cores: 'Seleção de cores',
};

export const CATEGORIA_LABELS: Record<FormularioTemplate['categoria'], string> = {
  gestante: 'Gestante',
  newborn: 'Newborn',
  familia: 'Família',
  casamento: 'Casamento/Evento',
  geral: 'Geral',
};

export const STATUS_ENVIO_LABELS: Record<FormularioStatusEnvio, string> = {
  nao_enviado: 'Não enviado',
  enviado: 'Aguardando resposta',
  respondido: 'Respondido',
  expirado: 'Expirado',
};
