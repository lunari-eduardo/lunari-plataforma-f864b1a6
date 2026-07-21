# Design DNA do Lunari

> Documento oficial de referência para toda decisão de UX e UI no Lunari.
> Deve ser consultado ANTES de qualquer plano de interface, componente ou fluxo.
> Em conflito com uma implementação: revisar a implementação, não o DNA.

---

## Filosofia

O Lunari deve transmitir a sensação de um software profissional, sofisticado e extremamente organizado, sem parecer complexo.

A interface deve desaparecer durante o uso. O fotógrafo nunca deve sentir que está preenchendo formulários ou operando um ERP.

Cada tela deve parecer um painel de acompanhamento do negócio.

A prioridade é:

- clareza
- ritmo visual
- poucos elementos
- muito espaço
- ações evidentes

Nunca quantidade de informações.

---

## Linguagem visual

A linguagem do Lunari não é baseada em dashboards financeiros.
Também não é baseada em ferramentas para designers.

Ela se aproxima muito mais de:

- Linear
- Notion Calendar
- Raycast
- Arc Browser
- Stripe Dashboard

Ou seja: interfaces extremamente limpas, modernas e silenciosas.

---

## Hierarquia

Toda tela deve possuir exatamente três níveis visuais.

### Nível 1 — Informações críticas
Exemplo: cliente, valor pendente, status, ação principal.
Sempre possuem maior contraste.

### Nível 2 — Informações de contexto
Exemplo: pacote, descrição, quantidade, data.
Nunca competem com o nível 1.

### Nível 3 — Informações auxiliares
Exemplo: observações, subtítulos, ajuda, textos explicativos.
Sempre discretas.

---

## Componentes

Todos os componentes devem seguir a mesma linguagem.
Nunca criar componentes exclusivos para uma página.

Se existe um Card de Sessão, o mesmo conceito deve aparecer em:

- Workflow
- Galerias
- Financeiro
- CRM

Mudando apenas o conteúdo. Nunca a linguagem.

---

## Cards

Todos os cards do Lunari devem transmitir três características.

### Muito respiro
Nunca elementos grudados. Muito espaço interno.

### Agrupamento claro
Tudo que pertence ao mesmo contexto permanece junto.
Sem linhas excessivas. O próprio espaçamento cria os grupos.

### Cantos suaves
Nenhum elemento agressivo. Tudo deve parecer leve.

---

## Ações

Toda tela deve responder claramente: **"O que o fotógrafo faz aqui?"**

Existe apenas uma ação principal.

- Workflow → Cobrar sessão
- Gallery → Nova galeria
- Dashboard → Ver detalhes

As demais ações ficam secundárias.

---

## Botões

Existem apenas três tipos.

- **Primário** — Ação principal.
- **Secundário** — Ações importantes.
- **Terciário** — Links e pequenas ações.

Nunca inventar novos estilos.

---

## Inputs

Os inputs devem desaparecer. O fotógrafo não deve sentir que está preenchendo campos.

Sempre que possível utilizar:

- dropdown elegante
- chips
- cards
- seletores

Ao invés de grandes formulários.

---

## Modais

Os modais do Lunari nunca são formulários. Eles são pequenos painéis operacionais.

Sempre responder:

1. o que existe
2. em que estado está
3. o que falta fazer

Depois vêm as edições. Nunca o contrário.

---

## Densidade

Baixa. Muito espaço. Poucos elementos. Poucas linhas. Poucos ícones.

Quando existir dúvida entre mostrar ou esconder: **preferir esconder**.

---

## Informações

Nunca repetir informação.

Se o Workflow já informa "Produto — A produzir", o modal não precisa repetir isso três vezes.

Cada informação aparece apenas onde faz sentido.

---

## Cores

As cores nunca devem carregar significado sozinhas. Sempre existir:

- texto
- ícone
- estado

Nunca depender apenas de verde/vermelho/laranja. O usuário deve compreender mesmo em escala de cinza.

---

## Ícones

Poucos. Sempre do mesmo peso visual. Nunca decorar.
Ícones apenas ajudam leitura. Nunca são protagonistas.

---

## Espaçamento

A sensação geral do Lunari deve ser: **"Existe menos interface do que realmente existe."**

Isso acontece graças ao espaçamento. O espaço vazio faz parte do layout.

---

## Animações

Curtas. Discretas. Sempre funcionais. Nunca decorativas.

Exemplos válidos: expandir sessão, concluir etapa, abrir modal, mover tarefa.

Jamais utilizar animações chamativas.

---

## Linguagem de UX

O Lunari não pergunta. O Lunari conduz.

| Evitar | Preferir |
|---|---|
| "Selecione uma etapa" | "Próxima etapa" |
| "Editar" | "Gerenciar" |
| "Status" | "Em produção" |

Sempre linguagem operacional.

---

## Sensação geral

Se uma tela nova for criada, ela deve transmitir imediatamente:

- calma
- organização
- precisão
- elegância
- confiança
- rapidez

Nunca deve transmitir:

- excesso de opções
- excesso de informação
- aparência técnica
- aparência de sistema administrativo
