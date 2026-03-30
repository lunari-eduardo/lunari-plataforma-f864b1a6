
# Correção profunda: taxas Asaas repassadas não podem virar desconto do fotógrafo

## O que encontrei de fato

Há mais de um problema, e o principal não é só “cálculo errado”: é uma combinação de **ordem de gravação**, **modelo financeiro inconsistente** e **lógicas duplicadas**.

### Raiz principal do erro atual
No fluxo do modal de cobrança:

1. `ChargeModal` cria uma cobrança local `pendente` **sem** `total_parcelas` real.
2. Depois, no checkout interno, `checkout-process-payment` cria o pagamento Asaas.
3. Se o cartão volta `CONFIRMED` na hora, a função **insere parcelas antes de atualizar a cobrança pai** com `total_parcelas = 2`.
4. O trigger `reconcile_cobranca_from_parcelas` ainda enxerga `total_parcelas = 1`, então a **primeira parcela já parece quitação total**.
5. Isso dispara `ensure_transaction_on_cobranca_paid`, que cria `clientes_transacoes` com:
   - `valor = 50`
   - `valor_liquido = 25,61`
   - `taxa_gateway = 24,39`
6. Depois a segunda parcela entra e a cobrança pai é corrigida para `valor_liquido = 51,22`, **mas a transação errada já ficou criada**.

Isso bate exatamente com o caso que vimos no banco:
- `cobranca_parcelas` está correta para a cobrança `afe7...`: 2x `valor_bruto 25`, `valor_liquido 25,61`, `taxa_gateway 0`
- mas `clientes_transacoes` ficou **totalmente errada**: `valor_liquido 25,61` e `taxa_gateway 24,39`

### Onde a correção anterior deixou escapar
1. Corrigimos `check-payment-status` e parte do checkout, mas **não eliminamos a corrida** entre:
   - atualização da cobrança pai
   - criação das parcelas
   - trigger de criação da transação
2. O `asaas-webhook` ainda usa `payment.value` como `valor_bruto`, o que contamina casos com repasse.
3. O trigger `ensure_transaction_on_cobranca_paid` ainda deriva taxa pela conta:
   `NEW.valor - NEW.valor_liquido`
   Isso é estruturalmente errado quando há repasse ao cliente.
4. A UI ainda confia em `cobrancas.valor_liquido` bruto do gateway em pontos como histórico, o que mostra líquido indevido.

## Regra correta que vou aplicar

Para o fotógrafo, a base financeira da sessão deve ser sempre o **valor nominal acordado**.

```text
valor nominal da sessão/cobrança = 50,00

se taxa de processamento é repassada:
  taxa_gateway do fotógrafo = 0

se taxa de antecipação é repassada:
  taxa_antecipacao do fotógrafo = 0

valor_liquido exibido ao fotógrafo =
  valor nominal
  - taxas que ELE absorve
```

Ou seja:

- se tudo é repassado, o fotógrafo vê:
  - Cobrado: 50,00
  - Recebido: 50,00
  - Taxas: 0,00

O `netValue` do Asaas continua útil como **dado técnico/auditoria**, mas não pode sozinho definir o resultado financeiro do fotógrafo quando a taxa foi repassada.

## Plano de implementação

### 1. Blindar a ordem do fluxo de confirmação
Ajustar `checkout-process-payment` para:

- atualizar a cobrança pai com:
  - `mp_payment_id`
  - `asaas_installment_id`
  - `total_parcelas`
  - snapshot das flags de taxa
- **antes** de inserir/upsertar `cobranca_parcelas`

Objetivo: impedir que a primeira parcela faça o trigger acreditar que a cobrança já está totalmente paga.

### 2. Reescrever a origem da verdade da transação financeira
Revisar `ensure_transaction_on_cobranca_paid` para Asaas:

- parar de calcular taxa por `NEW.valor - NEW.valor_liquido`
- buscar as parcelas da cobrança
- somar taxas por tipo
- zerar as taxas repassadas conforme `dados_extras`
- gravar em `clientes_transacoes`:
  - `valor = valor nominal`
  - `taxa_gateway = somente o que o fotógrafo absorve`
  - `taxa_antecipacao = somente o que o fotógrafo absorve`
  - `valor_liquido = valor nominal - taxas absorvidas`

Isso corrige:
- SessionPaymentsManager
- extrato
- linhas virtuais de taxa no `extrato_unificado`

### 3. Corrigir todos os caminhos Asaas, não só um
Aplicar a mesma regra em todos os pontos:

- `checkout-process-payment`
- `check-payment-status`
- `asaas-webhook`
- `gestao-asaas-create-payment`
- `checkout-get-data`
- UI de preview de parcelas/taxas

Hoje a lógica está duplicada em vários lugares; vou centralizar a regra para não escapar de novo.

### 4. Corrigir o webhook Asaas que ainda está contaminando `valor_bruto`
No `asaas-webhook`, trocar o uso de `payment.value` como base financeira nominal.

Para parcelas:
- `valor_bruto` deve continuar sendo o **nominal da cobrança/parcela**
- `payment.value` passa a ser só referência do valor cobrado no gateway, se precisarmos guardar isso separadamente

### 5. Ajustar a UI para não exibir líquido indevido
Revisar:

- `ChargeHistory`
- `useSessionPayments`
- `SessionPaymentsManager`

Para que:
- quando taxa é repassada, não apareça desconto do fotógrafo
- “Recebido” use o **líquido efetivo do fotógrafo**, não o `netValue` bruto do gateway
- o histórico não mostre `Líquido: 51,22` para uma cobrança nominal de `50,00` nesse cenário

### 6. Fazer backfill dos dados já corrompidos
Criar migração para recalcular registros Asaas já afetados:

- localizar cobranças com `dados_extras.repassarTaxasProcessamento = true` e/ou `repassarTaxaAntecipacao = true`
- recalcular `clientes_transacoes`
- corrigir taxas virtuais no extrato
- corrigir especificamente o caso já quebrado (`afe7...`) e demais equivalentes

Se necessário, também recalculo cobranças pagas recentes desse usuário para garantir consistência histórica.

## Arquivos / áreas que precisam entrar nessa revisão

- `supabase/functions/checkout-process-payment/index.ts`
- `supabase/functions/check-payment-status/index.ts`
- `supabase/functions/asaas-webhook/index.ts`
- `supabase/functions/gestao-asaas-create-payment/index.ts`
- `supabase/functions/checkout-get-data/index.ts`
- `src/hooks/useSessionPayments.ts`
- `src/components/payments/SessionPaymentsManager.tsx`
- `src/components/cobranca/ChargeHistory.tsx`
- nova migração SQL para:
  - `ensure_transaction_on_cobranca_paid`
  - backfill/correção de transações já quebradas
  - eventual endurecimento da reconciliação

## Validação que vou considerar obrigatória

Vou validar fim a fim estes cenários:

1. Sem repasse, sem antecipação
2. Repasse de processamento ligado
3. Repasse de processamento + antecipação repassada
4. Antecipação ativa, mas absorvida pelo fotógrafo
5. Checkout interno com confirmação imediata
6. Fallback por `check-payment-status`
7. Reflexo correto em:
   - histórico do modal de cobrança
   - Gerenciamento de Pagamentos
   - extrato

## Resultado esperado após a correção

Para cobranças com repasse ao cliente:
- fotógrafo **não verá taxa descontada**
- `Recebido` ficará em **R$ 50,00**, não `25,61` nem `51,22`
- extrato não criará saída falsa de taxa
- primeira parcela não vai mais disparar quitação total por engano
- a lógica ficará consistente entre modal, checkout, webhook e conferência manual
