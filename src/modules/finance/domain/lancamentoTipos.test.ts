import { describe, it, expect } from "vitest";
import {
  LANCAMENTO_TIPOS,
  LANCAMENTO_TIPOS_ORDEM,
  filterItemsByTipo,
  isCampoPermitido,
  tipoFromGrupo,
} from "./lancamentoTipos";
import type { ItemFinanceiro } from "./types";

const items: ItemFinanceiro[] = [
  { id: "1", nome: "Marketing", grupo: "Despesa Variável", userId: "u", ativo: true, criadoEm: "" },
  { id: "2", nome: "Aluguel", grupo: "Despesa Fixa", userId: "u", ativo: true, criadoEm: "" },
  { id: "3", nome: "Ensaios", grupo: "Receita Operacional", userId: "u", ativo: true, criadoEm: "" },
  { id: "4", nome: "Câmera", grupo: "Investimento", userId: "u", ativo: true, criadoEm: "" },
  { id: "5", nome: "Antigo", grupo: "Despesa Variável", userId: "u", ativo: true, criadoEm: "", archivedAt: "2025-01-01" },
  { id: "6", nome: "Inativo", grupo: "Despesa Variável", userId: "u", ativo: false, criadoEm: "" },
];

describe("lancamentoTipos", () => {
  it("ordem canônica cobre exatamente 5 tipos v1", () => {
    expect(LANCAMENTO_TIPOS_ORDEM).toHaveLength(5);
    for (const t of LANCAMENTO_TIPOS_ORDEM) expect(LANCAMENTO_TIPOS[t]).toBeDefined();
  });

  it("filterItemsByTipo restringe pelo grupo e ignora arquivados/inativos", () => {
    const desp = filterItemsByTipo(items, "despesa_variavel");
    expect(desp.map((i) => i.id)).toEqual(["1"]);

    const rec = filterItemsByTipo(items, "receita_operacional");
    expect(rec.map((i) => i.id)).toEqual(["3"]);

    const inv = filterItemsByTipo(items, "investimento");
    expect(inv.map((i) => i.id)).toEqual(["4"]);
  });

  it("tipoFromGrupo é o inverso da taxonomia", () => {
    expect(tipoFromGrupo("Despesa Fixa")).toBe("despesa_fixa");
    expect(tipoFromGrupo("Receita Não Operacional")).toBe("receita_nao_operacional");
  });

  it("isCampoPermitido bloqueia campos proibidos por tipo", () => {
    expect(isCampoPermitido("despesa_variavel", "cliente")).toBe(false);
    expect(isCampoPermitido("despesa_variavel", "favorecido")).toBe(true);
    expect(isCampoPermitido("receita_operacional", "vencimento")).toBe(false);
    expect(isCampoPermitido("receita_operacional", "recebimento")).toBe(true);
    expect(isCampoPermitido("investimento", "descricaoAtivo")).toBe(true);
    expect(isCampoPermitido("receita_nao_operacional", "sessao")).toBe(false);
  });

  it("Receita Operacional possui contextoPreForm com 3 opções", () => {
    const meta = LANCAMENTO_TIPOS.receita_operacional;
    expect(meta.contextoPreForm?.opcoes.map((o) => o.id)).toEqual([
      "sessao",
      "venda_avulsa",
      "outro",
    ]);
  });
});
