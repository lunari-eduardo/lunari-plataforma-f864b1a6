/**
 * Payer hints — fonte única de dados fiscais/contato para provedores de pagamento.
 *
 * Regras:
 * - Email: só passa quando é ASCII puro (Asaas rejeita não-ASCII).
 * - Telefone: só dígitos (10-11).
 * - CPF/CNPJ: só dígitos com DV válido.
 * - CEP: só dígitos (8).
 * - Nunca inventa valores; retorna undefined quando ausente/inválido.
 *
 * Copiado 1:1 do Gallery para congelar a regra de negócio.
 */

export interface PayerHints {
  name?: string;
  firstName?: string;
  email?: string;
  phone?: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  cityName?: string;
  state?: string;
}

export function normalizeEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const trimmed = String(email).trim();
  if (!trimmed) return undefined;
  // Rejeita qualquer não-ASCII (Asaas rejeita)
  if (/[^\x00-\x7F]/.test(trimmed)) return undefined;
  if (!/^[\x21-\x7E]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return undefined;
  return trimmed;
}

export function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return undefined;
  // Remove código de país 55 se presente
  const local = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length < 10 || local.length > 11) return undefined;
  return local;
}

export function normalizeCep(cep?: string | null): string | undefined {
  if (!cep) return undefined;
  const digits = String(cep).replace(/\D/g, "");
  return digits.length === 8 ? digits : undefined;
}

function cpfDvValid(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cpf[10]);
}

function cnpjDvValid(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + parseInt(base[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 12) + d1, w2);
  return d1 === parseInt(cnpj[12]) && d2 === parseInt(cnpj[13]);
}

export function normalizeCpfCnpj(value?: string | null): string | undefined {
  if (!value) return undefined;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 11 && cpfDvValid(digits)) return digits;
  if (digits.length === 14 && cnpjDvValid(digits)) return digits;
  return undefined;
}

function firstName(name?: string): string | undefined {
  if (!name) return undefined;
  const first = name.trim().split(/\s+/)[0];
  return first || undefined;
}

export interface ResolveHintsArgs {
  supabase: any;
  clienteId: string;
}

export async function resolvePayerHints({
  supabase,
  clienteId,
}: ResolveHintsArgs): Promise<PayerHints> {
  const { data: cliente } = await supabase
    .from("clientes")
    .select(
      "nome, email, telefone, whatsapp, cpf_cnpj, cep, endereco, endereco_numero, endereco_complemento, bairro, cidade, uf",
    )
    .eq("id", clienteId)
    .maybeSingle();

  if (!cliente) return {};

  const hints: PayerHints = {
    name: cliente.nome?.trim() || undefined,
    firstName: firstName(cliente.nome),
    email: normalizeEmail(cliente.email),
    phone: normalizePhone(cliente.whatsapp || cliente.telefone),
    cpfCnpj: normalizeCpfCnpj(cliente.cpf_cnpj),
    postalCode: normalizeCep(cliente.cep),
    address: cliente.endereco?.trim() || undefined,
    addressNumber: cliente.endereco_numero?.trim() || undefined,
    complement: cliente.endereco_complemento?.trim() || undefined,
    province: cliente.bairro?.trim() || undefined,
    cityName: cliente.cidade?.trim() || undefined,
    state: cliente.uf?.trim() || undefined,
  };

  return hints;
}

export function payerHintsFlags(h: PayerHints): string {
  return [
    `name=${h.name ? "Y" : "N"}`,
    `email=${h.email ? "Y" : "N"}`,
    `phone=${h.phone ? "Y" : "N"}`,
    `cpf=${h.cpfCnpj ? "Y" : "N"}`,
    `addr=${h.postalCode && h.addressNumber ? "Y" : "N"}(${h.postalCode ? "cep" : ""}${h.addressNumber ? "+num" : ""}${h.cityName ? "+city" : ""})`,
  ].join(" ");
}
