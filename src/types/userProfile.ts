export interface UserProfile {
  id: string;
  nomeCompleto: string;
  nomeEmpresa: string;
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
  // Aparência
  tema: 'claro' | 'escuro' | 'sistema';
  temaCor: 'azul' | 'verde' | 'terracota' | 'rosa' | 'cinza' | 'lilas' | 'bege' | 'marrom';
  temaCorHex: string;
  // Notificações
  notificacoesWhatsapp: boolean;
  // Automações
  habilitarAutomacoesWorkflow: boolean;
  habilitarAlertaProdutosDoCliente: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_USER_PROFILE: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
  nomeCompleto: '',
  nomeEmpresa: '',
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
  tema: 'sistema',
  temaCor: 'marrom',
  temaCorHex: '#5F3624',
  notificacoesWhatsapp: true,
  habilitarAutomacoesWorkflow: true,
  habilitarAlertaProdutosDoCliente: true
};