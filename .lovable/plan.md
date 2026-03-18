

# Plano: Separação Financeira Bruto/Líquido/Taxas

## Problema Central

O sistema registra R$100 como "Pago" no modal e na transação financeira, mas o fotógrafo recebeu apenas R$97,05. Não há separação entre o que o cliente pagou e o que o fotógrafo recebeu.

## Abordagem

Manter `valor` (bruto) em `clientes_transacoes` para cálculo de saldo pendente do cliente (via `recompute_session_paid`), mas adicionar colunas de valor líquido e taxas para o financeiro do fotógrafo. A UI mostra ambos os conceitos.

## Mudanças

### 1. Banco de Dados

Adicionar colunas em `clientes_transacoes`:

```sql
ALTER TABLE clientes_transacoes
  ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC,
  ADD COLUMN IF NOT EXISTS taxa_gateway NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_antecipacao NUMERIC DEFAULT 0;
```

Atualizar trigger `ensure_transaction_on_cobranca_paid` para preencher esses campos a partir de `cobrancas.valor_liquido` e calcular taxas.

### 2. Hook `useSessionPayments.ts`

- Adicionar campo `totalRecebido` (soma de `valorLiquido` quando disponível, senão `valor`)
- Adicionar campo `totalTaxas` (soma de taxas)
- Expor esses valores para a UI

### 3. UI `SessionPaymentsManager.tsx`

**Resumo financeiro** — Substituir grid atual por:

```
COBRADO      RECEBIDO       TAXAS        PENDENTE
R$ 400,00    R$ 388,10      R$ 11,90     R$ 230,00
```

- "Cobrado" = soma bruta dos pagamentos pagos (o que o cliente pagou)
- "Recebido" = soma líquida (o que o fotógrafo recebeu de fato)
- "Taxas" = diferença (gateway + antecipação)
- "Pendente" = total da sessão - cobrado

**Tabela de pagamentos** — Cada linha mostra:

```
R$ 33,33
Recebido: R$ 32,35
Taxa: -R$ 0,98
```

Para pagamentos manuais (sem gateway), mostrar apenas o valor sem breakdown.

### 4. Trigger `ensure_transaction_on_cobranca_paid`

```sql
v_valor_transacao := NEW.valor;  -- bruto (mantém para saldo pendente)
v_valor_liquido := NEW.valor_liquido;  -- líquido
v_taxa_gateway := CASE WHEN NEW.valor_liquido IS NOT NULL 
                       THEN NEW.valor - NEW.valor_liquido ELSE 0 END;

INSERT INTO clientes_transacoes (
  ..., valor, valor_liquido, taxa_gateway
) VALUES (
  ..., v_valor_transacao, v_valor_liquido, v_taxa_gateway
);
```

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Adicionar colunas `valor_liquido`, `taxa_gateway`, `taxa_antecipacao` em `clientes_transacoes`; atualizar trigger |
| `src/hooks/useSessionPayments.ts` | Calcular `totalRecebido` e `totalTaxas`; ler `valor_liquido` das transações |
| `src/components/payments/SessionPaymentsManager.tsx` | Reformular resumo financeiro com Cobrado/Recebido/Taxas/Pendente; melhorar breakdown por linha |
| `src/types/sessionPayments.ts` | Já tem os campos necessários |

## Nota sobre saldo pendente

O campo `valor_pago` em `clientes_sessoes` continua usando **valor bruto** (via `recompute_session_paid`), pois ele representa quanto o cliente já pagou da dívida — independente de taxas. Taxas são problema do fotógrafo, não do cliente. O pendente do cliente é sempre: `valor_total - valor_pago(bruto)`.

