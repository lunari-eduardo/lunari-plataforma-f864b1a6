/**
 * A.1 — Matcher de confirmação (texto/voz) para capabilities sensíveis.
 *
 * Provider-agnostic: recebe apenas o `ConfirmationChallenge` da tool + a
 * resposta do usuário (transcrição de voz ou input digitado). Retorna se a
 * confirmação é válida e, quando não, uma razão curta que a UI pode mostrar.
 *
 * Regras (v1):
 *  - `type_name`: normaliza (trim, lowercase, colapsa espaços, remove acentos,
 *    remove pontuação leve) e exige match exato com `expected` normalizado.
 *    Voz costuma vir sem pontuação/caps — a normalização absorve isso.
 *  - Sem `challenge`: aceita palavras de assentimento explícitas
 *    ("confirmo", "sim, confirmo", "pode ir", "yes, confirm", ...).
 *    Rejeita apenas "sim"/"ok" isolados para evitar falso-positivo por voz.
 */

import type { ConfirmationChallenge } from "@/shared/capability/ai-adapter";

export type ConfirmationSource = "text" | "voice";

export interface ConfirmationMatchResult {
  ok: boolean;
  reason?:
    | "empty"
    | "mismatch"
    | "needs_explicit_phrase"
    | "no_challenge_declined";
  normalizedInput: string;
  normalizedExpected?: string;
}

export interface ConfirmationMatchOptions {
  source?: ConfirmationSource;
}

const AFFIRMATIVE_PHRASES = [
  "confirmo",
  "confirmar",
  "sim confirmo",
  "sim, confirmo",
  "pode confirmar",
  "pode ir",
  "pode prosseguir",
  "eu confirmo",
  "yes confirm",
  "yes, confirm",
  "confirm",
  "i confirm",
];

const NEGATIVE_PHRASES = [
  "cancelar",
  "cancela",
  "nao",
  "não",
  "no",
  "abortar",
  "para",
  "stop",
];

export function normalizeForConfirmation(value: string): string {
  return (value ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[.,;:!?"'`´]/g, " ") // pontuação leve → espaço
    .replace(/\s+/g, " ")
    .trim();
}

export function matchConfirmation(
  challenge: ConfirmationChallenge | undefined,
  userInput: string,
  opts: ConfirmationMatchOptions = {},
): ConfirmationMatchResult {
  const normalizedInput = normalizeForConfirmation(userInput);

  if (!normalizedInput) {
    return { ok: false, reason: "empty", normalizedInput };
  }

  // Desafio type_name (mais estrito — usado para deletes/publishes destrutivos)
  if (challenge?.challenge?.type === "type_name") {
    const expected = normalizeForConfirmation(challenge.challenge.expected);
    if (!expected) {
      // Fallback defensivo: se o expected veio vazio, exige frase afirmativa.
      return matchConfirmation(undefined, userInput, opts);
    }
    const ok = normalizedInput === expected;
    return {
      ok,
      reason: ok ? undefined : "mismatch",
      normalizedInput,
      normalizedExpected: expected,
    };
  }

  // Sem type_name → exige frase afirmativa explícita
  if (NEGATIVE_PHRASES.some((p) => normalizedInput === p)) {
    return { ok: false, reason: "no_challenge_declined", normalizedInput };
  }

  const isAffirmative = AFFIRMATIVE_PHRASES.some(
    (p) => normalizedInput === p || normalizedInput.startsWith(p + " "),
  );
  if (!isAffirmative) {
    return { ok: false, reason: "needs_explicit_phrase", normalizedInput };
  }
  return { ok: true, normalizedInput };
}

/**
 * Helper de UX: mensagem curta em pt-BR para exibir ao usuário quando o match
 * falha. Provider-agnostic — não depende de nenhum SDK de LLM.
 */
export function confirmationFailureMessage(
  result: ConfirmationMatchResult,
  challenge: ConfirmationChallenge | undefined,
): string {
  switch (result.reason) {
    case "empty":
      return "Preciso que você confirme por texto ou voz para continuar.";
    case "mismatch":
      return `Para confirmar, digite ou diga exatamente: "${challenge?.challenge?.expected ?? ""}".`;
    case "needs_explicit_phrase":
      return 'Diga "confirmo" (ou "pode prosseguir") para eu executar essa ação.';
    case "no_challenge_declined":
      return "Ação cancelada — nada foi executado.";
    default:
      return "Não consegui validar sua confirmação. Pode repetir?";
  }
}
