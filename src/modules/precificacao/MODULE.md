# Módulo: Precificação

> Bloco B2 — cobertura de IA para precificação. Leitura e simulação livres,
> escrita de preço somente com aprovação humana.

## 1. O que este módulo resolve

Concentra a inteligência de preço do estúdio: estrutura de custos (custos
pessoais, custos de estúdio, equipamentos), custo por hora real, markup,
tabelas progressivas de foto extra, preço de pacotes e metas de faturamento.

Antes do B2, essa lógica vivia espalhada em `services/pricing`, hooks e
adapters, sem nenhuma capability. A Lu não conseguia responder "quanto devo
cobrar por esse ensaio?" nem "o que acontece se eu subir a foto extra?".

## 2. Os 6 critérios de decisão (PRODUCT_GUIDE)

1. **Reduz trabalho manual?** Sim — simulação de preço em uma frase, sem abrir
   a calculadora.
2. **Aumenta previsibilidade financeira?** Sim — expõe custo por hora e
   lucratividade real por trabalho.
3. **É seguro por padrão?** Sim — nenhuma escrita de preço acontece sem
   aprovação humana explícita.
4. **Cabe no fluxo Lead → Pós-venda?** Sim — alimenta orçamento e fechamento.
5. **Tem baixa curva de aprendizado?** Sim — a Lu explica o cálculo em
   linguagem operacional, com breakdown.
6. **É reversível?** Escritas são pontuais e auditadas; sessões existentes
   nunca são afetadas (regras congeladas).

## 3. Camadas

```text
domain/       types.ts, calculo.ts        → matemática pura, sem Supabase
application/  leitura.ts                  → capabilities de leitura
              simulacao.ts                → capabilities de simulação (puras)
              mutations.ts                → capabilities de escrita (aprovação)
ai/           permissions.ts, tools.ts, context.ts
```

`domain/calculo.ts` é 100% puro e testável: `valorPorFoto`, `faixaPara`,
`custoFixoMensal`, `custoPorHora`, `calcularPrecoFinal`, `validarFaixas`.

## 4. Capabilities

### Leitura (`precificacao:read`, sem aprovação)
- `precificacao.getConfiguracao` — modelo ativo e parâmetros gerais
- `precificacao.getEstruturaCustos` — custos fixos, custo/hora, pró-labore
- `precificacao.listTabelas` — tabelas global e por categoria
- `precificacao.getTabelaCategoria` — faixas de uma categoria
- `precificacao.listPacotesComPreco` — pacotes com valor base e foto extra
- `precificacao.getMetas` — metas anuais e personalizadas
- `precificacao.listCenarios` — cenários salvos da calculadora
- `precificacao.diagnostico` — aponta buracos (custo/hora zerado, tabela
  faltando, margem abaixo do desejado)

### Simulação (leitura pura, nada é gravado)
- `precificacao.simularPreco` — horas + markup + produtos → preço e lucratividade
- `precificacao.simularFotoExtra` — quantidade → valor unitário e faixa aplicada
- `precificacao.simularPacote` — pacote + extras + desconto → total ao cliente
- `precificacao.simularImpactoTabela` — antes/depois de uma proposta de faixas

### Escrita (`precificacao:write`, **aprovação obrigatória**)
- `precificacao.setModelo`
- `precificacao.upsertTabelaGlobal`
- `precificacao.upsertTabelaCategoria`
- `precificacao.updatePacotePreco`
- `precificacao.updateMargemEHoras`
- `precificacao.setMetas`

## 5. Invariantes

- **Simular ≠ aplicar.** Nenhuma capability de simulação escreve no banco.
- **Validação antes do gate.** Faixas inválidas falham sem consumir aprovação.
- **Diff obrigatório.** Toda escrita devolve `diff` (antes → depois).
- **Congelamento.** Alterar preço não mexe em `regras_congeladas` de sessões
  existentes; vale só para sessões novas.
- **RLS.** Nenhuma query filtra `user_id` manualmente — o isolamento é do banco.

## 6. Tabelas usadas

`modelo_de_preco`, `tabelas_precos`, `pacotes`, `categorias`,
`pricing_configuracoes`, `pricing_gastos_pessoais`, `pricing_custos_estudio`,
`pricing_equipamentos`, `pricing_configs`, `metas_personalizadas`.

## 7. Superfície MCP

Todas as capabilities são `audience: app + mcp` (usuário final). Não há nada
admin aqui. As escritas caem no tier `write` e, no MCP, exigem o fluxo de
aprovação (`assistant_approvals`) antes de executar.
