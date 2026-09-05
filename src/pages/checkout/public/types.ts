import { ProviderBlock } from '../ProviderCheckout';

export const SUPABASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'tlnjspsywycbudhewsfv'}.supabase.co`;
export const POLL_INTERVAL = 15_000;
export const POLL_MAX = 10 * 60 * 1000;

export function maskCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function maskCardNumber(v: string): string {
  return v
    .replace(/\D/g, '')
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .trim()
    .slice(0, 19);
}

export function maskExpiry(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length > 6) return `${d.slice(0, 2)}/${d.slice(2, 6)}`;
  if (d.length >= 3) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d;
}

export function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return d;
}

export function validateCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(d[10]);
}

export function validateCpfCnpj(val: string): boolean {
  const d = val.replace(/\D/g, '');
  if (d.length === 11) return validateCpf(val);
  if (d.length === 14) return true;
  return false;
}

export function isAsciiEmail(v: string): boolean {
  const s = (v || '').trim();
  if (!s || /[^\x00-\x7F]/.test(s)) return false;
  return /^[\x21-\x7E]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s);
}

export interface AccountFees {
  creditCard: {
    operationValue: number;
    detachedMonthlyFeeValue: number;
    installmentMonthlyFeeValue: number;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
  };
  pix: { fixedFeeValue: number };
  discount?: {
    active: boolean;
    expiration?: string;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
  };
}

export interface PayerHints {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  cpfCnpj: string | null;
}

export interface PayerMissing {
  name: boolean;
  email: boolean;
  phone: boolean;
  cpfCnpj: boolean;
}

export interface CheckoutData {
  provedor?: string;
  provider?: ProviderBlock;
  cobranca: { id: string; valor: number; descricao: string; status: string };
  photographer: { name: string | null; logoUrl: string | null; userId: string };
  settings: {
    habilitarPix: boolean;
    habilitarCartao: boolean;
    habilitarBoleto: boolean;
    maxParcelas: number;
    absorverTaxa: boolean;
    ireiAntecipar?: boolean;
    repassarTaxaAntecipacao?: boolean;
    incluirTaxaAntecipacao?: boolean;
  };
  accountFees: AccountFees | null;
  payerHints?: PayerHints;
  payerMissing?: PayerMissing;
  theme?: { primaryColor: string | null };
  galleryToken?: string | null;
  isPaid?: boolean;
}

export type Tab = 'pix' | 'card';
