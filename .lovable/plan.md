

# Melhorias na Aba Extrato + Verificação Gallery

## Análise Gallery (Asaas)

A Gallery **está correta**: `asaas-gallery-payment` insere como `'pendente'`, `asaas-gallery-webhook` extrai `netValue`, cria parcelas, e os triggers fazem o resto. Nenhuma correção necessária.

## Mudanças no Extrato

### 1. Ordenação por data+hora (decrescente)

**Problema**: A view `extrato_unificado` ordena apenas por `data` (tipo `date`, sem hora). Registros do mesmo dia aparecem em ordem arbitrária.

**Solução**: Alterar a query no `useExtratoSupabase.ts` para ordenar por `created_at` (timestamp) como critério secundário:
```
.order('data', { ascending: false })
.order('created_at', { ascending: false })
```
E exibir o horário na tabela usando `created_at` quando disponível.

### 2. Origem: Gallery vs Gestão + Meio de Pagamento

**Problema**: A view SQL hardcoda `'workflow'` para todas as `clientes_transacoes`. Não distingue se o pagamento veio do Gallery ou do Gestão, nem qual meio de pagamento (Asaas, InfinitePay, MP, Manual).

**Solução**: Atualizar a view `extrato_unificado` via migration:
- JOIN com `cobrancas` para extrair `provedor` e `galeria_id`
- Se `galeria_id IS NOT NULL` → origem = `'gallery'`, senão `'workflow'`  
- Adicionar coluna `meio_pagamento` (provedor da cobrança)

Atualizar constantes e UI:
- Adicionar `gallery` em `ORIGEM_COLORS` e `ORIGEM_LABELS`
- Exibir meio de pagamento como sub-badge ou texto auxiliar

### 3. Badges verde/vermelho para Entrada/Saída

**Problema**: Badges usam `variant="default"` e `variant="secondary"` — sem distinção visual forte.

**Solução**: Aplicar classes diretas:
- Entrada: `bg-green-500/15 text-green-700 border-green-300`
- Saída: `bg-red-500/15 text-red-700 border-red-300`

### 4. Remover coluna Parcelas

**Problema**: Parcelas no extrato geral são redundantes (já constam no histórico do cliente).

**Solução**: Remover coluna "Parcela" do `ExtratoTable.tsx` e do header. Manter os dados na view para exportação se necessário.

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | Recriar view `extrato_unificado` com JOIN em `cobrancas` para `provedor` e `galeria_id`, nova coluna `meio_pagamento` |
| `src/hooks/useExtratoSupabase.ts` | Ordenar por `created_at` como critério secundário, mapear novos campos |
| `src/components/extrato/ExtratoTable.tsx` | Remover coluna Parcela, badges verde/vermelho, exibir horário, mostrar meio de pagamento |
| `src/constants/extratoConstants.ts` | Adicionar `gallery` nas cores/labels de origem |
| `src/types/extrato.ts` | Adicionar `gallery` em `ExtratoOrigem`, adicionar campo `meioPagamento` |

