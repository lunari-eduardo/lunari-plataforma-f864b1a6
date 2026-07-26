/**
 * Provider: profile — expõe fatos declarados do perfil do fotógrafo.
 * Fonte: tabela `profiles` (já preenchida pelo Onboarding e Meu Perfil).
 *
 * Facts publicados:
 *  - profile.nome
 *  - profile.empresa
 *  - profile.nicho
 *  - profile.cidade
 *  - profile.telefone
 *  - profile.logo_url
 *
 * NÃO trazemos email, CPF/CNPJ ou telefones secundários por padrão (dados
 * sensíveis; se precisar, criamos provider dedicado com Policy).
 */
import type { ContextFact, ContextProvider } from "..";
import { supabase } from "@/integrations/supabase/client";

export const profileContextProvider: ContextProvider = {
  id: "profile",
  async load(userId: string): Promise<ContextFact[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("nome, empresa, nicho, cidade, cidade_nome, cidade_uf, telefone, logo_url, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return [];

    const updatedAt = (data as { updated_at?: string }).updated_at;
    const facts: ContextFact[] = [];
    const push = (key: string, value: unknown) => {
      if (value == null || value === "") return;
      facts.push({ key, value, source: "human", confidence: "high", updatedAt });
    };

    push("profile.nome", data.nome);
    push("profile.empresa", data.empresa);
    push("profile.nicho", data.nicho);
    push(
      "profile.cidade",
      data.cidade_nome && data.cidade_uf
        ? `${data.cidade_nome}/${data.cidade_uf}`
        : data.cidade,
    );
    push("profile.telefone", data.telefone);
    push("profile.logo_url", data.logo_url);
    return facts;
  },
};
