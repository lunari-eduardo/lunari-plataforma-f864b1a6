/**
 * Utilitários para identificar signatários de contratos (Autentique).
 * Match robusto: tenta perfil → user.email → fallback "outro signer".
 */
import type { Contrato } from '@/types/contrato';

export interface SignerLite {
  public_id?: string;
  email?: string;
  nome?: string;
  papel?: string;
  link?: string;
  status?: 'assinado' | 'recusado' | 'visualizado' | 'pendente' | string;
  timestamp?: string | null;
}

const norm = (s?: string | null) => (s || '').trim().toLowerCase();

/**
 * Encontra o signer que corresponde ao fotógrafo logado.
 * Estratégia em cascata:
 *   1. e-mail do perfil
 *   2. e-mail do usuário (auth)
 *   3. signer cujo e-mail NÃO é o do cliente (assume que é o outro)
 */
export function getFotografoSigner(
  contrato: Pick<Contrato, 'signers' | 'cliente'>,
  options: { profileEmail?: string | null; userEmail?: string | null }
): SignerLite | null {
  const signers = (contrato.signers as SignerLite[]) || [];
  if (signers.length === 0) return null;

  const candidates = [norm(options.profileEmail), norm(options.userEmail)].filter(Boolean);
  for (const cand of candidates) {
    const match = signers.find((s) => norm(s.email) === cand);
    if (match) return match;
  }

  // Fallback: signer que não é o cliente
  const clienteEmail = norm(contrato.cliente?.email);
  if (clienteEmail) {
    const other = signers.find((s) => norm(s.email) && norm(s.email) !== clienteEmail);
    if (other) return other;
  }
  return null;
}

export function getFotografoPendente(
  contrato: Pick<Contrato, 'signers' | 'cliente' | 'signature_external_id'>,
  options: { profileEmail?: string | null; userEmail?: string | null }
): SignerLite | null {
  const s = getFotografoSigner(contrato, options);
  if (!s) return null;
  if (s.status === 'assinado' || s.status === 'recusado') return null;
  // Se a Autentique não devolveu short_link para o fotógrafo (comportamento da
  // plataforma quando o signer é o dono da conta API), usa a URL pública do
  // documento — o fotógrafo loga e assina pelo painel.
  const fallbackLink = contrato.signature_external_id
    ? `https://app.autentique.com.br/documentos/visualizar/${contrato.signature_external_id}`
    : null;
  const link = s.link || fallbackLink;
  if (!link) return null;
  return { ...s, link };
}

export function countAssinaturas(contrato: Pick<Contrato, 'signers'>): { assinados: number; total: number } {
  const signers = (contrato.signers as SignerLite[]) || [];
  return {
    assinados: signers.filter((s) => s.status === 'assinado').length,
    total: signers.length,
  };
}
