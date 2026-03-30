

# Correção: Líquido incorreto no histórico de cobranças + Padrão de pagamento compartilhado entre contas

## Problema 1: Histórico de cobranças mostra "Líquido" incorreto quando taxas são repassadas

No `ChargeHistory.tsx` (linha 127), o componente exibe `valorLiquido` sempre que ele difere de `valor`:

```tsx
{cobranca.valorLiquido != null && cobranca.valorLiquido !== cobranca.valor && (
  <p>Líquido: {formatCurrency(cobranca.valorLiquido)}</p>
)}
```

Quando taxas são repassadas ao cliente, o `valor_liquido` vindo do Asaas pode ser **maior** que o `valor` nominal (ex: R$ 51,22 para R$ 50,00), pois o gateway cobrou a mais e devolveu o excedente. Isso gera confusão — o fotógrafo não deveria ver "Líquido" nesse caso, pois para ele o recebido é o valor integral.

**Correção**: Incluir `dados_extras` no mapeamento de cobranças (`useCobranca.ts`) e no tipo `Cobranca`, depois no `ChargeHistory` verificar se `repassarTaxasProcessamento === true` — se sim, ocultar a linha de "Líquido" (pois o fotógrafo recebe o valor nominal completo).

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/types/cobranca.ts` | Adicionar campo opcional `dadosExtras?: Record<string, any>` |
| `src/hooks/useCobranca.ts` | Mapear `dados_extras` para `dadosExtras` no fetch |
| `src/components/cobranca/ChargeHistory.tsx` | Ocultar "Líquido" quando `dadosExtras.repassarTaxasProcessamento === true` |

---

## Problema 2: Todas as contas compartilham o mesmo "meio de pagamento padrão"

O `ProviderSelector.tsx` lê `is_default` de `dados_extras` (linhas 55, 78, 92, 107):

```ts
const isDefault = settings.is_default === true;
```

Porém o `setAsDefault` no `usePaymentIntegration.ts` grava na **coluna** `is_default` da tabela `usuarios_integracoes` — que é filtrada por `user_id`. Isso está correto no hook.

O problema é que o `ProviderSelector` **não consulta a coluna** `is_default` — ele só faz `select('provedor, status, dados_extras')`. Então ele depende de `dados_extras.is_default`, que foi gravado no passado por código legado e pode estar compartilhado/inconsistente.

**Correção**: O `ProviderSelector` deve incluir `is_default` na query e usá-lo como fonte de verdade em vez de `dados_extras.is_default`.

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/cobranca/ProviderSelector.tsx` | Adicionar `is_default` ao select; usar coluna em vez de `dados_extras.is_default` |

