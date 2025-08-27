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

export type RegimeTributario = 'mei' | 'simples';

export interface UserPreferences {
  id: string;
  // Notificações
  notificacoesWhatsapp: boolean;
  // Automações
  habilitarAutomacoesWorkflow: boolean;
  habilitarAlertaProdutosDoCliente: boolean;
  // Regime Tributário
  regimeTributario: RegimeTributario;
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
  notificacoesWhatsapp: true,
  habilitarAutomacoesWorkflow: true,
  habilitarAlertaProdutosDoCliente: true,
  regimeTributario: 'mei'
};