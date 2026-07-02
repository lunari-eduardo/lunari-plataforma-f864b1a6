/**
 * viaCep — lookup gratuito de endereço a partir do CEP.
 * Usa fetch com timeout 4s. Nunca lança; retorna null em qualquer falha.
 */

import { unmaskDigits } from "./validateCpfCnpj";

export interface ViaCepResult {
  cep: string; // dígitos puros
  logradouro: string;
  bairro: string;
  localidade: string; // cidade
  uf: string;
  complemento?: string;
}

export async function lookupCep(cep: string): Promise<ViaCepResult | null> {
  const digits = unmaskDigits(cep);
  if (digits.length !== 8) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.erro) return null;
    return {
      cep: digits,
      logradouro: data.logradouro || "",
      bairro: data.bairro || "",
      localidade: data.localidade || "",
      uf: (data.uf || "").toUpperCase(),
      complemento: data.complemento || undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
