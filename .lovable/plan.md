

# Refinar UX da "Adição Rápida de Sessão" (Workflow)

## Objetivos
1. **Produtos via dropdown** — substituir input manual por `ProductSearchCombobox` (já existe), com auto-preenchimento de valor unitário a partir da tabela `produtos`. Usuário só edita quantidade.
2. **Navegação 100% por teclado** — `Tab` ordenado, `Enter` avança/submete, `Esc` fecha, atalhos globais (`Ctrl+S` salvar, `Ctrl+P` adicionar produto, `Ctrl+L` limpar).
3. **Preenchimento mais rápido** — auto-focar primeiro campo ao abrir, autoselect em todos numéricos (já existe parcialmente), botão "Salvar e Adicionar Outra" para fluxo em lote.

---

## Mudanças de UX

### A) Produtos: combobox + linha enxuta

Antes (3 inputs manuais por linha): Nome livre + Qtd + Valor unit.
Depois (1 combobox + Qtd):

```text
[ Buscar produto ▾                   ] [ Qtd: 1 ] R$ 150,00 (auto) = R$ 150,00 [×]
                                                  ^ vlr unitário do cadastro
```

- Ao selecionar produto → preenche `nome`, `valorUnitario` automaticamente.
- Quantidade default = 1, focada após selecionar (pronta para digitar).
- Linha mostra subtotal (qtd × valor) à direita.
- Se não houver produtos cadastrados, mostrar link discreto "Cadastrar produto em Configurações".
- **Permite repetir o mesmo produto** em linhas diferentes (caso raro: pacotes diferentes do mesmo item).

### B) Navegação por teclado

| Atalho | Ação |
|---|---|
| `Tab` / `Shift+Tab` | Navegação natural respeitando ordem visual |
| `Enter` em qualquer campo (exceto produtos) | Avança para próximo campo lógico |
| `Enter` no último campo (Valor Pago) | Submete o formulário |
| `Ctrl+Enter` | Submete de qualquer campo |
| `Ctrl+Shift+Enter` | "Salvar e Adicionar Outra" (mantém aberto, limpa, foca cliente) |
| `Ctrl+P` | Adiciona linha de produto e foca o combobox novo |
| `Ctrl+L` | Limpar formulário (com confirmação se houver dados) |
| `Esc` | Fecha o painel (com confirmação se dirty) |
| `↓` no combobox de produto | Abre dropdown / navega itens |
| `Enter` no combobox | Seleciona item destacado |

**Indicação visual**: mostrar discretamente os atalhos no rodapé do painel (`Ctrl+Enter` para salvar · `Ctrl+P` adicionar produto · `Esc` fechar`), em texto pequeno cinza.

### C) Auto-focus e fluxo

- Ao expandir o painel (`isOpen=true`) → focar `ClientSearchCombobox`.
- Ao adicionar linha de produto → focar o combobox dela.
- Após submeter com sucesso (modo padrão) → fechar painel.
- Após "Salvar e Adicionar Outra" → manter aberto, limpar campos, focar cliente.

### D) Microajustes visuais

- Adicionar `tabIndex` explícito onde houver ambiguidade (combos custom).
- `Label` de cada campo recebe `htmlFor` + `id` no input, para acessibilidade e click-to-focus.
- Botão "Salvar Sessão" ganha variante secundária ao lado: "Salvar e Adicionar Outra" (`Ctrl+Shift+Enter`).
- Tooltip nos botões mostrando atalho.

---

## Implementação técnica

### Mudança em `src/components/workflow/QuickSessionAdd.tsx`

1. **Tipo `ManualProduct` enriquecido** — adicionar `produtoId?: string` para rastrear vínculo (mantém `nome` para compatibilidade com payload existente em `useSessionsRealtime.createManualSession`).
2. **Substituir bloco de produtos** (linhas 449-506) por:
   - Linha com `<ProductSearchCombobox onSelect={...} />` no lugar do `Input nome`.
   - Ao selecionar: `handleProductChange(index, { produtoId, nome, valorUnitario: produto.valorVenda })` e foca input de quantidade.
   - Manter input de quantidade (col-span-2).
   - Mostrar valor unitário como **texto somente-leitura** (não mais input editável) — vem do cadastro.
   - Subtotal + botão remover à direita.
3. **Hook de atalhos globais** — `useEffect` com `keydown` listener no container, registrando `Ctrl+S`, `Ctrl+P`, `Ctrl+L`, `Ctrl+Enter`, `Ctrl+Shift+Enter`, `Esc`. Listener preso a `containerRef` para não vazar para a página.
4. **Auto-focus**:
   - `useEffect` em `isOpen` → após 50ms, foca o input do `ClientSearchCombobox` (precisa expor `ref` ou usar `querySelector` no container).
   - Ao adicionar produto → `setTimeout` foca o último combobox de produto.
5. **Botão "Salvar e Adicionar Outra"** — nova prop opcional `onSubmit` retorna sucesso; nesse caso chama `handleClear()` mas não `setIsOpen(false)` e re-foca cliente.
6. **Footer com legenda de atalhos** — `<div class="text-2xs text-muted-foreground">Atalhos: Ctrl+Enter salvar · Ctrl+P produto · Esc fechar</div>`.
7. **Confirmação ao fechar com dados não salvos** — flag `isDirty` (qualquer campo ≠ default) → ao `Esc`/`Cancelar`, mostrar `confirm()` simples.

### Compatibilidade com backend

- `QuickSessionData.produtosIncluidos` continua sendo `{ nome, quantidade, valorUnitario }[]` — o `produtoId` fica apenas no estado UI; **não há mudança de schema**.
- `useSessionsRealtime.createManualSession` permanece intacto — já recebe e persiste produtos como `produtos_incluidos` com tipo `'manual'`. (Se quisermos rastrear `produtoId` no futuro, fica como evolução posterior.)
- Nenhuma migration necessária.

---

## Anti-bugs

1. **Combobox dentro de Collapsible**: garantir que o `dropdown-solid` do `ProductSearchCombobox` não seja cortado por `overflow-hidden` do Collapsible — já usa `position: absolute z-50`, validado no padrão usado em outros lugares.
2. **`Enter` no combobox** não deve submeter o form — o combobox já consome o evento; reforçar com `e.preventDefault()` no handler global se `e.target` estiver dentro de combobox aberto.
3. **`Ctrl+S` global**: prevenir o "salvar página" do navegador com `e.preventDefault()`.
4. **Produtos sem cadastro**: se `products.length === 0`, mostrar mensagem inline + botão para abrir Configurações (sem quebrar o fluxo).
5. **Foco perdido ao adicionar linha**: usar `ref` map por índice de linha para localizar o combobox correto.

---

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/workflow/QuickSessionAdd.tsx` | Substitui input manual de produtos por `ProductSearchCombobox`; adiciona atalhos de teclado, auto-focus, botão "Salvar e Adicionar Outra", footer de atalhos, confirmação ao sair com dirty |
| `src/components/agenda/ProductSearchCombobox.tsx` | Pequeno ajuste: aceitar `autoFocus` opcional e expor melhor o foco interno (se necessário) |

