export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  whatsapp?: string;
  endereco?: string;
  observacoes?: string;
  origem?: string;
  // Novos campos opcionais para perfil completo
  dataNascimento?: string;
  conjuge?: {
    nome?: string;
    dataNascimento?: string;
  };
  filhos?: Array<{
    id: string;
    nome?: string;
    dataNascimento?: string;
  }>;
}

export interface OrigemCliente {
  id: string;
  nome: string;
  cor?: string;
}