

# Fix: Venda Avulsa sem valor total no Workflow + melhorias

## Diagnóstico da causa raiz

O trigger `recalculate_session_valor_total` recalcula `valor_total` em todo INSERT/UPDATE como:

```text
valor_total = valor_base_pacote + valor_total_foto_extra + produtos_manuais + valor_adicional - desconto
```

O hook `useVendaAvulsa` envia `valor_total: 96` mas o trigger **sobrescreve** para `0` porque todos os componentes estão zerados:
- `valor_base_pacote = 0` (nenhum pacote selecionado)
- `produtos_incluidos = []` (produtos NÃO são salvos no JSONB)
- `valor_adicional = 0`

Resultado: `valor_total = 0`, mas `valor_pago = 96` (inserido via trigger de transações), gerando um crédito falso de +R$ 96.

## Solução

### 1. Hook `useVendaAvulsa.ts` - Salvar produtos e descrição corretamente

- Aceitar novo campo `produtos` no input (array de `{nome, quantidade, valorUnitario}`)
- Converter para formato `produtos_incluidos` JSONB com `tipo: 'manual'` para que o trigger do banco contabilize corretamente
- Se o usuário editou o valor manualmente e ele difere da soma dos componentes, colocar a diferença em `valor_adicional` (para que o trigger recalcule corretamente)
- Montar `descricao` detalhada incluindo nomes dos produtos e pacote

### 2. Modal `ModalVendaAvulsa.tsx` - Quantidade de produtos + descrição rica

- Adicionar controle de quantidade (+/-) nos chips de produtos (como no workflow)
- No submit, enviar array de produtos para o hook
- Montar descrição automática: "Pacote X + Produto Y (x2) + Produto Z"
- Permitir o usuário complementar com texto livre

### 3. Lógica de valor_adicional como "ajuste"

Quando o valor manual difere da soma calculada (pacote + produtos):

```text
valor_adicional = valorFinalUsuario - (valorBasePacote + totalProdutos) + desconto
```

Isso garante que o trigger recalcule `valor_total` para o valor correto que o usuário definiu.

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useVendaAvulsa.ts` | Aceitar `produtos[]`, salvar em `produtos_incluidos` JSONB, calcular `valor_adicional` como ajuste |
| `src/components/financas/ModalVendaAvulsa.tsx` | Controles de quantidade nos chips, enviar produtos ao hook, descrição automática |

## Resultado esperado

- Venda avulsa sem pacote com produto de R$ 96 → `produtos_incluidos` JSONB com o produto → trigger calcula `valor_total = 96`
- Com pagamento imediato: `valor_pago = 96`, `status_financeiro = 'pago'`
- Sem pagamento: `valor_pago = 0`, `status_financeiro = 'pendente'`, valor pendente visível no workflow
- Workflow mostra descrição: "Venda avulsa - Album Premium (x2)"

