

# Correção: Provedor padrão não pré-selecionado no modal de cobrança

## Causa raiz

O `ProviderSelector.tsx` lê `is_default` de dentro do JSON `dados_extras`:

```ts
// Linha 55 — Mercado Pago
const isDefault = settings.is_default === true;

// Linha 78 — InfinitePay
const isDefault = infinitePay.dados_extras?.is_default === true;
```

Porém, o campo `is_default` é uma **coluna da tabela** `usuarios_integracoes`, não um campo dentro do JSON `dados_extras`. O banco confirma: InfinitePay tem `is_default = true` na coluna, mas `dados_extras->>'is_default'` é `NULL`.

Resultado: nenhum provedor é marcado como `isDefault`, então o auto-select na linha 127 pega `available[0]` — que é Mercado Pago (primeiro a ser processado no código).

## Correção

### `ProviderSelector.tsx`

1. Incluir `is_default` no SELECT do Supabase (linha 37):
```ts
.select('provedor, status, dados_extras, is_default')
```

2. Atualizar `IntegrationData` para incluir `is_default: boolean`

3. Usar a coluna em vez do JSON para cada provedor:
```ts
// Mercado Pago
const isDefault = mercadoPago.is_default === true;

// InfinitePay
const isDefault = infinitePay.is_default === true;

// PIX Manual
const isDefault = pixManual.is_default === true;

// Asaas
const isDefault = asaas.is_default === true;
```

Isso faz com que InfinitePay (que tem `is_default = true` no banco) seja corretamente detectado e pré-selecionado.

## Arquivo a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/cobranca/ProviderSelector.tsx` | Ler `is_default` da coluna, não do JSON |

