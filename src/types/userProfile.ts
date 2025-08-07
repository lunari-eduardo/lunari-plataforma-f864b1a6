export interface UserProfile {
  id: string;
  nomeCompleto: string;
  nomeEmpresa: string;
  tipoFotografia: string;
  cpfCnpj: string;
  emailPrincipal: string;
  enderecoComercial: string;
  telefones: string[];
  siteRedesSociais: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserBranding {
  id: string;
  logoUrl?: string;
  logoFileName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  id: string;
  // Preferências da Conta
  idioma: 'pt' | 'en' | 'es';
  fusoHorario: string;
  moedaPadrao: 'BRL' | 'USD' | 'EUR';
  formatoData: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  // Aparência
  tema: 'claro' | 'escuro' | 'sistema';
  // Notificações
  notificacoesEmail: boolean;
  notificacoesWhatsapp: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_USER_PROFILE: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
  nomeCompleto: '',
  nomeEmpresa: '',
  tipoFotografia: '',
  cpfCnpj: '',
  emailPrincipal: '',
  enderecoComercial: '',
  telefones: [],
  siteRedesSociais: []
};

export const DEFAULT_USER_BRANDING: Omit<UserBranding, 'id' | 'createdAt' | 'updatedAt'> = {
  logoUrl: undefined,
  logoFileName: undefined
};

export const DEFAULT_USER_PREFERENCES: Omit<UserPreferences, 'id' | 'createdAt' | 'updatedAt'> = {
  idioma: 'pt',
  fusoHorario: 'America/Sao_Paulo',
  moedaPadrao: 'BRL',
  formatoData: 'DD/MM/YYYY',
  tema: 'sistema',
  notificacoesEmail: true,
  notificacoesWhatsapp: true
};