# Estorno de pagamento de extras (Gallery / Asaas) — plano revisado

## Diagnóstico confirmado no banco

Para a galeria `2fdd500e-…` (sessão de 07/10/2026):

- Cobrança de extras `a9a0247d-…`, provedor `asaas`, status `pago`, R$ 80.
- Transação `d2530663-…` em `clientes_transacoes` com `cobranca_id` preenchido e descrição `Fotos extras (cobranca a9a0247d-…) Asaas`.
- O `asaas_payment_id` (`pay_n36k894rtmi6h9xb`) está em `cobranca_parcelas` — **não** em `cobrancas.dados_extras`.

Duas falhas encadeadas:

1. **Front:** o pagamento exibido vem da transação, então seu `id` é o UUID da transação. O estorno só sabe extrair a cobrança de ids no formato `asaas-…` / `asaas-parcela-…`; como não bate, aborta com "Não foi possível identificar a cobrança Asaas para estornar" — nem chama o gateway.
2. **Edge function:** mesmo com o id certo, ela procura o `asaas_payment_id` só em `cobrancas.dados_extras`; ali não existe, então falharia depois.

## Estratégia aprovada

Separar por ambiente: **sandbox = estorno interno (sem gateway)**; **produção = corrigir o caminho real**.

### 1. Sandbox tratado como pagamento manual

- Detectar o ambiente da integração Asaas ativa do usuário (`usuarios_integracoes.dados_extras.environment`), exposto por um hook simples de leitura.
- Quando o ambiente for sandbox, no modal de estorno:
  - a opção "Realizar estorno automaticamente no Asaas" fica desligada e desabilitada, com nota "ambiente de teste — estorno registrado apenas no Lunari";
  - o estorno segue o caminho interno já existente (transação espelhada negativa / crédito do cliente), sem chamar a edge function;
  - liberar também a exclusão do pagamento, igual a um pagamento manual.
- Nada muda no comportamento em produção.

### 2. Produção — resolver a cobrança corretamente

- Propagar `cobrancaId` (e `parcelaId` quando existir) da transação para o objeto de pagamento, usando a coluna `cobranca_id`, em vez de depender de prefixo no id.
- No estorno, resolver a cobrança nesta ordem: `payment.cobrancaId` → prefixos `asaas-parcela-` / `asaas-` (retrocompatível) → consulta da transação pelo id. Só então mostrar erro.

### 3. Produção — fallback do `asaas_payment_id` na edge function

- Quando `cobrancas.dados_extras` não tiver o id, buscar em `cobranca_parcelas` pela `cobranca_id` (parcela paga/confirmada, menor número de parcela). Só depois retornar erro.
- Registrar em log o ambiente usado (sandbox/produção) para evitar estorno cruzado.

### 4. Mensagens de erro

Exibir a mensagem real devolvida pela edge function/gateway em vez de texto genérico.

## Arquivos afetados

- `src/hooks/useSessionPayments.ts` — `cobrancaId` na montagem do pagamento, resolução robusta no `refundPayment`, bypass do gateway em sandbox.
- `src/types/sessionPayments.ts` — campos opcionais `cobrancaId` / `parcelaId`.
- Modal de estorno (`src/components/payments/…`) — estado do switch e liberação de exclusão em sandbox.
- `supabase/functions/gestao-asaas-refund/index.ts` — fallback via `cobranca_parcelas` + log de ambiente.

Sem migração de banco; nenhum registro financeiro existente é alterado.
