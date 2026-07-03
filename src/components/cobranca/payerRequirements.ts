/**
 * payerRequirements — quais campos do pagador são exigidos por provedor.
 * Fonte única para o ChargeModal decidir se mostra formulário completo
 * ou apenas resumo dos dados já presentes no CRM.
 */

import type { PayerFieldsValue } from "./PayerFieldsBlock";
import { isAsciiEmail, isValidPhoneBR, validateCpfCnpj } from "@/lib/validateCpfCnpj";

export type PayerProvider =
  | "pix_asaas"
  | "link_asaas"
  | "link_mp"
  | "link_infinitepay"
  | "pix_manual";

export type PayerField = "nome" | "email" | "telefone" | "cpfCnpj";

/**
 * pix_asaas → exige nome+CPF+telefone (Asaas API bloqueia PIX sem eles).
 * link_asaas → exige apenas nome; qualquer dado ausente é coletado inline
 *              pelo próprio cliente na página pública `/checkout/:id`.
 * link_mp → nome+email+telefone (regra MP).
 * link_infinitepay/pix_manual → nada; coleta ocorre fora deste modal.
 */
export const REQUIRED: Record<PayerProvider, PayerField[]> = {
  pix_asaas: ["nome", "cpfCnpj", "telefone"],
  link_asaas: ["nome"],
  link_mp: ["nome", "email", "telefone"],
  link_infinitepay: [],
  pix_manual: [],
};


/** Considera um campo "preenchido e válido" para efeito de bloquear/liberar. */
export function fieldIsPresent(field: PayerField, v: PayerFieldsValue): boolean {
  switch (field) {
    case "nome":
      return (v.nome || "").trim().length >= 2;
    case "email":
      return isAsciiEmail(v.email);
    case "telefone":
      return isValidPhoneBR(v.telefone);
    case "cpfCnpj":
      return validateCpfCnpj(v.cpfCnpj);
  }
}

/** Retorna somente os campos exigidos pelo provedor que ainda estão faltando. */
export function computeMissingFields(
  provider: PayerProvider | null,
  v: PayerFieldsValue,
): PayerField[] {
  if (!provider) return [];
  return REQUIRED[provider].filter((f) => !fieldIsPresent(f, v));
}
