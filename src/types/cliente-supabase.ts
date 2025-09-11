export interface ClienteSupabase {
  id: string;
  user_id: string;
  nome: string;
  email?: string;
  telefone: string;
  whatsapp?: string;
  endereco?: string;
  observacoes?: string;
  origem?: string;
  data_nascimento?: string;
  created_at: string;
  updated_at: string;
}

export interface ClienteFamilia {
  id: string;
  cliente_id: string;
  user_id: string;
  tipo: 'conjuge' | 'filho';
  nome?: string;
  data_nascimento?: string;
  created_at: string;
}

export interface ClienteDocumento {
  id: string;
  cliente_id: string;
  user_id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  storage_path: string;
  descricao?: string;
  created_at: string;
}

export interface ClienteCompleto extends ClienteSupabase {
  familia: ClienteFamilia[];
  documentos: ClienteDocumento[];
}