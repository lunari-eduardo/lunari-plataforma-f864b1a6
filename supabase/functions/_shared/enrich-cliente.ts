/**
 * enrichClienteIfMissing — grava dados fiscais/contato no CRM apenas onde
 * a coluna estiver vazia/null. Nunca sobrescreve dados já preenchidos pelo
 * fotógrafo. Nunca toca em `whatsapp` (canal próprio do fotógrafo).
 *
 * Grava CPF/CNPJ e CEP em dígitos puros (sem máscara).
 */

import { normalizeCep, normalizeCpfCnpj, normalizeEmail, normalizePhone } from "./payer-hints.ts";

export interface EnrichPatch {
  email?: string;
  telefone?: string;
  cpfCnpj?: string;
  cep?: string;
  endereco?: string;
  enderecoNumero?: string;
  enderecoComplemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

export async function enrichClienteIfMissing(
  supabase: any,
  clienteId: string,
  patch: EnrichPatch,
): Promise<{ updated: boolean; fields: string[] }> {
  if (!clienteId) return { updated: false, fields: [] };

  const { data: current } = await supabase
    .from("clientes")
    .select(
      "email, telefone, cpf_cnpj, cep, endereco, endereco_numero, endereco_complemento, bairro, cidade, uf",
    )
    .eq("id", clienteId)
    .maybeSingle();

  if (!current) return { updated: false, fields: [] };

  const norm = {
    email: normalizeEmail(patch.email),
    telefone: normalizePhone(patch.telefone),
    cpf_cnpj: normalizeCpfCnpj(patch.cpfCnpj),
    cep: normalizeCep(patch.cep),
    endereco: patch.endereco?.trim() || undefined,
    endereco_numero: patch.enderecoNumero?.trim() || undefined,
    endereco_complemento: patch.enderecoComplemento?.trim() || undefined,
    bairro: patch.bairro?.trim() || undefined,
    cidade: patch.cidade?.trim() || undefined,
    uf: patch.uf?.trim().toUpperCase() || undefined,
  };

  const updates: Record<string, string> = {};
  const isEmpty = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");

  for (const [key, value] of Object.entries(norm)) {
    if (!value) continue;
    if (isEmpty((current as Record<string, unknown>)[key])) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { updated: false, fields: [] };
  }

  const { error } = await supabase
    .from("clientes")
    .update(updates)
    .eq("id", clienteId);

  if (error) {
    console.error("[enrichClienteIfMissing] update failed:", error);
    return { updated: false, fields: [] };
  }

  return { updated: true, fields: Object.keys(updates) };
}
