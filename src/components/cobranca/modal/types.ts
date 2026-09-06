import { ChargeStep } from '../ChargeStepBadge';

export interface ChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome?: string;
  clienteWhatsapp?: string;
  sessionId?: string;
  valorSugerido: number;
  valorSinal?: number;
  step?: ChargeStep | null;
  finalidade?: 'sessao' | 'fotos_extras' | 'sessao_e_extras';
  galeriaId?: string | null;
  qtdFotos?: number | null;
  snapshotFotosIncluidas?: number | null;
  valorSessaoComponente?: number | null;
  valorExtrasComponente?: number | null;
  nomeSessao?: string;
  initialTab?: 'cobrar' | 'historico';
  allowChangeValor?: boolean;
  descricao?: string;
}

export interface AsaasSettingsState {
  habilitarPix: boolean;
  habilitarCartao: boolean;
  habilitarBoleto: boolean;
  maxParcelas: number;
  absorverTaxa: boolean;
  ireiAntecipar: boolean;
  repassarTaxaAntecipacao: boolean;
}

export const BACKEND_ERROR_MESSAGES: Record<string, string> = {
  MISSING_CPF: 'CPF/CNPJ do cliente é obrigatório para gerar cobrança PIX/Boleto no Asaas.',
  MISSING_PHONE: 'Telefone do cliente é obrigatório para gerar cobrança PIX/Boleto no Asaas.',
  MISSING_NAME: 'Nome do cliente é obrigatório.',
  MISSING_EMAIL: 'Email do cliente é obrigatório.',
  INVALID_CPF: 'CPF/CNPJ inválido.',
  INVALID_EMAIL: 'Este email não é aceito pelo Asaas. Use um email sem acentos ou caracteres especiais.',
  ASAAS_CUSTOMER_ERROR: 'Erro ao sincronizar cliente com o Asaas.',
  ASAAS_PAYMENT_ERROR: 'Erro ao criar cobrança no Asaas.',
  PIX_GENERATION_FAILED: 'Falha ao gerar código PIX.',
  PIX_DISABLED: 'PIX não está habilitado nas configurações Asaas.',
  BOLETO_DISABLED: 'Boleto não está habilitado nas configurações Asaas.',
  CARD_DISABLED: 'Cartão de crédito não está habilitado nas configurações Asaas.',
  ASAAS_NOT_CONFIGURED: 'Integração Asaas não configurada.',
};

export function mapBackendError(code?: string, fallback?: string): string {
  if (code && BACKEND_ERROR_MESSAGES[code]) return BACKEND_ERROR_MESSAGES[code];
  return fallback || 'Erro ao processar cobrança.';
}
