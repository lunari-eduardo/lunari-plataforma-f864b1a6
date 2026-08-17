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
  clienteId?: string | null;
  galleryId?: string | null;
  sessionId?: string | null;
  visitorId?: string | null;
}

export async function resolvePayerHints({
  supabase,
  clienteId,
  galleryId,
  sessionId,
  visitorId,
}: ResolveHintsArgs): Promise<PayerHints> {
  let resolvedClienteId = clienteId || null;
  let rawName: string | undefined;
  let rawEmail: string | undefined;
  let rawPhone: string | undefined;
  let rawCpf: string | undefined;
  let rawCep: string | undefined;
  let rawAddress: string | undefined;
  let rawNumber: string | undefined;
  let rawComplement: string | undefined;
  let rawBairro: string | undefined;
  let rawCity: string | undefined;
  let rawState: string | undefined;

  // 1. Se temos galleryId mas não temos clienteId, buscar cliente_id e dados denormalizados na galeria
  if (galleryId) {
    const { data: gal } = await supabase
      .from("galerias")
      .select("cliente_id, cliente_nome, cliente_email, cliente_telefone, session_id")
      .eq("id", galleryId)
      .maybeSingle();

    if (gal) {
      if (!resolvedClienteId && gal.cliente_id) resolvedClienteId = gal.cliente_id;
      if (!sessionId && gal.session_id) sessionId = gal.session_id;
      if (gal.cliente_nome && !rawName) rawName = gal.cliente_nome;
      if (gal.cliente_email && !rawEmail) rawEmail = gal.cliente_email;
      if (gal.cliente_telefone && !rawPhone) rawPhone = gal.cliente_telefone;
    }
  }

  // 2. Se temos sessionId mas não temos clienteId, buscar em clientes_sessoes
  if (sessionId && !resolvedClienteId) {
    const { data: sessao } = await supabase
      .from("clientes_sessoes")
      .select("cliente_id")
      .or(`id.eq.${sessionId},session_id.eq.${sessionId}`)
      .maybeSingle();

    if (sessao?.cliente_id) {
      resolvedClienteId = sessao.cliente_id;
    }
  }

  // 3. Buscar registro principal do cliente se cliente_id foi resolvido
  if (resolvedClienteId) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select(
        "nome, email, telefone, whatsapp, cpf_cnpj, cep, endereco, endereco_numero, endereco_complemento, bairro, cidade, uf",
      )
      .eq("id", resolvedClienteId)
      .maybeSingle();

    if (cliente) {
      rawName = cliente.nome || rawName;
      rawEmail = cliente.email || rawEmail;
      rawPhone = cliente.whatsapp || cliente.telefone || rawPhone;
      rawCpf = cliente.cpf_cnpj || rawCpf;
      rawCep = cliente.cep || rawCep;
      rawAddress = cliente.endereco || rawAddress;
      rawNumber = cliente.endereco_numero || rawNumber;
      rawComplement = cliente.endereco_complemento || rawComplement;
      rawBairro = cliente.bairro || rawBairro;
      rawCity = cliente.cidade || rawCity;
      rawState = cliente.uf || rawState;
    }
  }

  // 4. Se temos visitorId, mesclar dados de galeria_visitantes
  if (visitorId) {
    const { data: visitor } = await supabase
      .from("galeria_visitantes")
      .select("nome, email, telefone, cpf_cnpj")
      .eq("id", visitorId)
      .maybeSingle();

    if (visitor) {
      if (visitor.nome && !rawName) rawName = visitor.nome;
      if (visitor.email && !rawEmail) rawEmail = visitor.email;
      if (visitor.telefone && !rawPhone) rawPhone = visitor.telefone;
      if (visitor.cpf_cnpj && !rawCpf) rawCpf = visitor.cpf_cnpj;
    }
  }

  const hints: PayerHints = {
    name: rawName?.trim() || undefined,
    firstName: firstName(rawName),
    email: normalizeEmail(rawEmail),
    phone: normalizePhone(rawPhone),
    cpfCnpj: normalizeCpfCnpj(rawCpf),
    postalCode: normalizeCep(rawCep),
    address: rawAddress?.trim() || undefined,
    addressNumber: rawNumber?.trim() || undefined,
    complement: rawComplement?.trim() || undefined,
    province: rawBairro?.trim() || undefined,
    cityName: rawCity?.trim() || undefined,
    state: rawState?.trim() || undefined,
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

