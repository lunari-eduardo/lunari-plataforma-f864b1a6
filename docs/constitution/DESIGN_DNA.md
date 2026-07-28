# Design DNA do Lunari

> Documento oficial de referência para toda decisão de UX e UI no Lunari.
> Deve ser consultado ANTES de qualquer plano de interface, componente ou fluxo.
> Em conflito com uma implementação: revisar a implementação, não o DNA.

---

## 1. Filosofia

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

## 2. Filosofia cromática

A identidade da Lunari transmite **luxo silencioso**.

- O **preto grafite** representa estabilidade e tecnologia.
- Os **neutros** representam clareza.
- O **dourado** representa inteligência, qualidade e atenção aos detalhes.

O dourado nunca compete com o conteúdo. Ele existe apenas para criar momentos de percepção premium.

---

## 3. Linguagem visual

A linguagem do Lunari não é baseada em dashboards financeiros. Também não é baseada em ferramentas para designers. Ela se aproxima muito mais de:

- Linear
- Notion Calendar
- Raycast
- Arc Browser
- Stripe Dashboard

Interfaces extremamente limpas, modernas e silenciosas.

---

## 4. Hierarquia

Toda tela deve possuir exatamente três níveis visuais.

### Nível 1 — Informações críticas
Cliente, valor pendente, status, ação principal. Sempre com maior contraste.

### Nível 2 — Informações de contexto
Pacote, descrição, quantidade, data. Nunca competem com o nível 1.

### Nível 3 — Informações auxiliares
Observações, subtítulos, ajuda, textos explicativos. Sempre discretas.

---

## 5. Distribuição da identidade

**85% Neutros · 12% Preto Grafite · 3% Dourado.**

A ordem de percepção do usuário deve ser:

Conteúdo → Dados → Navegação → Identidade.

Somente depois de ler o conteúdo o usuário percebe a marca. Se a identidade aparece antes, a proporção está errada.

---

## 6. Paleta oficial

### 6.1 Preto Grafite (assinatura da marca)

| Superfície | Valor |
|---|---|
| Sidebar | `#171717` |
| Hover Sidebar | `#202020` |
| Menu ativo | `#242424` |
| Divisórias | `#2E2E2E` |

### 6.2 Neutros — Light Mode

| Superfície | Valor |
|---|---|
| Background | `#F7F6F3` |
| Background secundário | `#F3F1ED` |
| Cards | `#FFFFFF` |
| Cards elevados | `#FCFBF9` |
| Border | `#E9E5DE` |
| Linha fina | `#ECE8E2` |
| Texto principal | `#1E1E1E` |
| Texto secundário | `#6F6F6F` |
| Placeholder | `#A7A7A7` |

### 6.3 Neutros — Dark Mode

| Superfície | Valor |
|---|---|
| Background | `#111111` |
| Background secundário | `#151515` |
| Cards | `#181818` |
| Cards elevados | `#1D1D1D` |
| Border | `#2A2A2A` |
| Texto | `#F3F3F3` |
| Texto secundário | `#A2A2A2` |
| Placeholder | `#6D6D6D` |

### 6.4 Dourado Institucional

Única cor de identidade da marca.

| Estado | Valor |
|---|---|
| Base | `#C6A36A` |
| Hover | `#D2B07B` |
| Pressed | `#AF8E59` |

Proibido:
- gradientes com dourado;
- efeitos metálicos ou brilho;
- preenchimento de grandes áreas.

### 6.5 Cores funcionais

| Estado | Valor |
|---|---|
| Sucesso | `#37B26C` |
| Erro | `#D94A4A` |
| Alerta | `#D89B2C` |
| Informação | `#4E88E5` |

Essas cores **nunca** são substituídas pelo dourado.

---

## 7. Uso do dourado

| Pode usar dourado em… | Nunca usar dourado em… |
|---|---|
| Ícone ativo da sidebar | Fundo da sidebar |
| Ícone dos cards de KPI | Valor numérico do KPI |
| Ícone e cursor do Assistente IA | Botão primário padrão |
| CTA Premium (upgrade/créditos/assinatura/demo) | Botões de ação comum |
| Contorno do "hoje" no calendário | Preenchimento de dia selecionado |
| Hover de ponto em gráfico de linha | Cor de série em gráfico |
| Logo | Foco de input |
| Loading pequeno / tooltip premium | Header, tabela, badge, switch, checkbox marcado |
| Conquistas e badges especiais | Grandes áreas de preenchimento |

Qualquer novo uso do dourado exige atualização deste documento **antes** de ir para o código.

---

## 8. Componentes

Todos os componentes seguem a mesma linguagem. Nunca criar componente exclusivo de uma página.

Se existe um Card de Sessão, o mesmo conceito aparece em Workflow, Galerias, Financeiro e CRM — mudando apenas o conteúdo, nunca a linguagem.

### Cards

- Muito respiro interno.
- Agrupamento por espaçamento (não por linhas).
- Cantos suaves.
- Background branco em light, `#181818` em dark.
- `radius: 20px`, border `#E9E5DE` (light) / `#2A2A2A` (dark).
- Sombra `0 8px 24px rgba(0,0,0,.03)` em light; quase inexistente em dark.

---

## 9. Regras por componente

### 9.1 Sidebar (permanente)

- Fundo `#171717` **em light e dark**. Nunca muda com o tema.
- Logo branca. Sem alteração em hover.
- Ícones inativos `rgba(255,255,255,.55)`; hover `#FFFFFF`.
- Item ativo: ícone `#C6A36A`, texto `#FFFFFF`, background `rgba(255,255,255,.06)`. **Nunca** dourado atrás do item.

### 9.2 Header

- Acompanha o tema: branco em light, `#111111` em dark.
- Sem sombra pesada — apenas `border-bottom`.

### 9.3 Cards

Ver seção 8.

### 9.4 Botões

**Primário** — fundo preto `#171717`, texto branco, hover `#2B2B2B`.

**CTA Premium** — fundo `#C6A36A`, texto `#171717`. Uso reservado a:
- Upgrade
- Comprar créditos
- Solicitar demonstração
- Assinatura

Não deve existir em excesso. Se aparece em qualquer outro contexto, é violação.

**Secundário** — branco, borda `#D8D4CE`, hover `#F5F3EF`.

### 9.5 Inputs

- Background branco.
- Border `#DDD8D1`.
- Focus: border `#171717`, glow `rgba(0,0,0,.04)`.
- **Nunca** dourado em foco ou borda.

### 9.6 Tabelas

- Header `#F8F6F3`.
- Hover linha `rgba(0,0,0,.025)`.
- Linha selecionada `rgba(0,0,0,.05)`.
- **Nunca** dourado.

### 9.7 KPIs

- Ícone: dourado.
- Título: cinza.
- Valor: preto.
- Comparativo: verde ou vermelho.
- Valor numérico **jamais** dourado.

### 9.8 Gráficos

Uma das maiores mudanças. Gráficos deixam de usar a cor institucional — a identidade fica mais sofisticada com escala monocromática.

- **Barras** — cinza médio `#6D6D6D`; barra atual `#171717`. Sem dourado.
- **Linha** — preta. Hover do ponto: dourado.
- **Área** — cinza claro. Hover: pequena iluminação dourada.
- **Pizza** — cinzas. Apenas um setor preto. **Nunca** dourado.

### 9.9 Badges

- Cinzas por padrão.
- Status usa apenas verde / vermelho / azul / laranja.
- Nunca dourado.

### 9.10 Switch / Checkbox / Calendário

- **Switch** — off cinza, on preto. Não dourado.
- **Checkbox** — vazio cinza, marcado preto, hover com borda dourada.
- **Calendário** — eventos cinza; "hoje" com contorno dourado; dia selecionado preto.

---

## 10. Assistente IA — exceção cromática

É o único módulo que pode usar dourado de forma consistente.

- Ícone: dourado.
- Cursor: dourado.
- Estado online: ponto dourado.
- Animações: douradas.

Isso cria uma associação subconsciente entre "inteligência" e a identidade da Lunari.

---

## 11. Microinterações douradas (lista fechada)

O dourado aparece apenas nos seguintes momentos:

1. Ícone ativo na sidebar.
2. Hover dos ícones de ação.
3. Ícone dos cards KPI.
4. Indicador da IA (ícone, cursor, ponto online, animações).
5. CTA Upgrade Premium.
6. Logo.
7. Pequenos detalhes de loading.
8. Tooltips premium.
9. Conquistas e badges especiais.

Qualquer uso fora desta lista exige atualização deste documento antes do código.

---

## 12. Ações

Toda tela deve responder: **"O que o fotógrafo faz aqui?"**

Existe apenas uma ação principal por tela.

- Workflow → Cobrar sessão
- Gallery → Nova galeria
- Dashboard → Ver detalhes

As demais ações ficam secundárias.

---

## 13. Densidade

Baixa. Muito espaço. Poucos elementos. Poucas linhas. Poucos ícones.

Na dúvida entre mostrar ou esconder: **esconder**.

---

## 14. Informações

Nunca repetir informação. Se o Workflow já informa "Produto — A produzir", o modal não repete isso três vezes. Cada informação aparece apenas onde faz sentido.

---

## 15. Cores (regra transversal)

Cor nunca carrega significado sozinha. Sempre acompanhada de:

- texto
- ícone
- estado

Nunca depender apenas de verde/vermelho/laranja. O usuário deve compreender mesmo em escala de cinza.

---

## 16. Ícones

Poucos. Sempre do mesmo peso visual. Nunca decorar. Ícones ajudam leitura — nunca são protagonistas.

---

## 17. Espaçamento

A sensação geral deve ser: **"Existe menos interface do que realmente existe."**

Isso acontece graças ao espaçamento. O espaço vazio faz parte do layout.

---

## 18. Animações

Curtas. Discretas. Sempre funcionais. Nunca decorativas.

Exemplos válidos: expandir sessão, concluir etapa, abrir modal, mover tarefa.

Nunca animações chamativas.

---

## 19. Linguagem de UX

O Lunari não pergunta. O Lunari conduz.

| Evitar | Preferir |
|---|---|
| "Selecione uma etapa" | "Próxima etapa" |
| "Editar" | "Gerenciar" |
| "Status" | "Em produção" |

Sempre linguagem operacional.

---

## 20. Sensação geral

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

---

## Débito de implementação

Este DNA é a fonte de verdade a partir de agora. Os itens abaixo ainda seguem a paleta antiga (terracota) e precisam ser migrados em ondas separadas, sem alterar o DNA:

1. `src/index.css` — tokens `--brand-*`, gradientes e sombras antigas.
2. `src/styles/lunari-design-rules.md` — descreve paleta terracota; reescrever com paleta grafite/dourado.
3. `tailwind.config.ts` — tokens de cor e sombra apontam para valores antigos.
4. `src/lib/visualTheme.ts` (`VisualThemeProvider`, `THEME_PRESETS`) — preset padrão migra para grafite/dourado sem quebrar temas alternativos.
5. Componentes com cor hardcoded (KPI cards, gráficos com `chart-primary`, hovers laranja/roxo).
6. Sidebar — hoje pode variar com o tema; travar em `#171717` para light e dark.
7. Recharts / módulo de gráficos — migrar séries para escala monocromática (cinza + preto).
