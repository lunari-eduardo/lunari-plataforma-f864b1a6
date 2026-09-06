/**
 * Capabilities de ESCRITA — módulo Precificação (Bloco B2).
 *
 * TODA escrita aqui altera o preço praticado pelo estúdio e exige aprovação
 * humana (ver `ai/permissions.ts`). Regras invioláveis:
 *
 *  1. Validação de domínio acontece ANTES do gate — faixa inválida falha sem
 *     consumir aprovação.
 *  2. A resposta traz o diff (antes → depois) para conferência.
 *  3. Nada aqui toca `regras_congeladas` de sessões existentes: alterar preço
 *     vale só para sessões NOVAS.
 *  4. RLS por `user_id` — nenhuma query filtra usuário manualmente.
 *
 * Refatorado: fachada modular que agrega os comandos de mutação.
 */

export * from "./mutations/common";
export * from "./mutations/tabelaMutations";
export * from "./mutations/configMetasMutations";
export * from "./mutations/pacoteCenarioMutations";
