

# Máscara BRL nos campos monetários + Botão produto na mesma linha

## Problema

1. Campos de valor em Pacotes (`valor_base`, `valor_foto_extra`) e Produtos (`preco_custo`, `preco_venda`) usam `type="number"` sem formatação — o usuário vê "2222" em vez de "2.222,00"
2. O botão "Adicionar Produto" ocupa uma linha inteira sozinho, desperdiçando espaço vertical

## Solução

### 1. Criar hook `useCurrencyInput`

Novo hook em `src/hooks/useCurrencyInput.ts` que:
- Recebe `value: number` e `onChange: (num: number) => void`
- Mantém estado interno de string formatada (ex: "1.234,56")
- Formata em tempo real enquanto o usuário digita (remove não-numéricos, insere pontos e vírgula)
- Usa `inputMode="decimal"` para teclado numérico no mobile
- Retorna `{ displayValue, handleChange, handleFocus, handleBlur, inputProps }`
- No blur, normaliza o valor e persiste via `onChange`

Lógica de formatação:
```
Input: "1234" → Display: "1.234,00" (on blur)
Input: "1234,5" → Display: "1.234,50" (on blur)  
Typing: keystroke-by-keystroke formatting of digits only
```

### 2. `PacoteForm.tsx` — Substituir `useNumberInput` por `useCurrencyInput`

Nos campos `valor_base` e `valor_foto_extra`:
- Trocar `type="number"` por `type="text"` com `inputMode="decimal"`
- Usar o novo hook para formatação automática
- Campo `fotos_incluidas` permanece como está (é quantidade, não moeda)

### 3. `Produtos.tsx` — Máscara + botão na mesma linha

**Campos monetários**: Usar `useCurrencyInput` em `preco_custo` e `preco_venda`

**Layout do botão**: Mover o botão "Adicionar Produto" para a mesma linha dos campos de preço:
```
[Preço de Custo] [Preço de Venda] [+ Adicionar Produto]
```
Remover o `<div className="flex justify-end">` separado e colocar o botão como terceiro item no `flex-wrap gap-4`, com `self-end` para alinhar na base.

### 4. `ProdutoFormModal.tsx` — Verificar e aplicar máscara

Verificar se o modal de edição de produto também usa inputs de valor sem máscara e aplicar o mesmo hook.

### 5. `SalvarPacoteModal.tsx` — Aplicar máscara

Campos `valor_base` e `valor_foto_extra` já usam `useNumberInput` — substituir por `useCurrencyInput`.

## Arquivos a criar/modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useCurrencyInput.ts` | Novo hook de máscara BRL |
| `src/components/configuracoes/PacoteForm.tsx` | Usar `useCurrencyInput` nos campos monetários |
| `src/components/configuracoes/Produtos.tsx` | Máscara + botão na linha dos preços |
| `src/components/configuracoes/ProdutoFormModal.tsx` | Aplicar máscara se necessário |
| `src/components/precificacao/SalvarPacoteModal.tsx` | Aplicar máscara nos campos monetários |

