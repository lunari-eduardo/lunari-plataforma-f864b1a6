# Correção: estorno de pagamento de extras (Gallery / Asaas)

## O que está acontecendo

Confirmei no banco, para a galeria `2fdd500e-…`:

- A cobrança de extras existe (`a9a0247d-…`, provedor `asaas`, status `pago`, R$ 80).
- Existe uma transação em `clientes_transacoes` (`d2530663-…`) com `cobranca_id` preenchido e descrição `Fotos extras (cobranca a9a0247d-…) Asaas`.
- O ID do pagamento no Asaas (`pay_n36k894rtmi6h9xb`) está gravado em `cobranca_parcelas`, **não** em `cobrancas.dados_extras` (que só tem as flags de repasse).

Com isso, há **duas falhas encadeadas**:

1. **Front (causa do erro na tela):** a lista de pagamentos monta o item a partir da transação, então o `id` do pagamento é o UUID da transação. A rotina de estorno só sabe extrair a cobrança de IDs que começam com `asaas-` ou `asaas-parcela-`. Como o ID não bate com nenhum padrão, ela aborta com "Não foi possível identificar a cobrança Asaas para estornar" — sem nem chamar o gateway.
2. **Edge function:** mesmo corrigindo o item 1, a função de estorno procura o `asaas_payment_id` apenas em `cobrancas.dados_extras`. Nesse caso ele não está lá, e a chamada falharia com "ID do pagamento no Asaas não encontrado".

## O que será feito

### 1. Propagar a cobrança até o item de pagamento
No hook que monta os pagamentos da sessão, incluir `cobrancaId` (e `parcelaId` quando houver) no objeto do pagamento, usando a coluna `cobranca_id` da transação. Assim o vínculo deixa de depender de parsing do ID textual.

### 2. Resolver a cobrança de forma robusta no estorno
Na rotina de estorno, resolver o ID da cobrança nesta ordem:
1. `payment.cobrancaId` (novo campo);
2. prefixos existentes `asaas-parcela-` / `asaas-` (retrocompatibilidade);
3. fallback: buscar `cobranca_id` na transação pelo ID do pagamento.

Só exibir o erro atual se todas as tentativas falharem.

### 3. Fallback do `asaas_payment_id` na edge function
Na função de estorno Asaas, quando não houver `asaas_payment_id` em `cobrancas.dados_extras`, buscar em `cobranca_parcelas` pela `cobranca_id` (parcela paga/confirmada, ordenada por número). Só então retornar erro.

### 4. Ambiente correto (sandbox vs produção)
Verificar de qual integração a cobrança nasceu e usar a mesma chave/ambiente no estorno, em vez de sempre pegar a integração `is_default` do usuário. Se a cobrança não guardar essa referência, manter o comportamento atual e registrar log claro do ambiente usado, para não estornar em produção uma cobrança de sandbox (e vice-versa).

### 5. Mensagens de erro
Passar a mostrar a mensagem real devolvida pelo gateway/edge function, em vez de mensagens genéricas, para diagnóstico futuro.

## Arquivos afetados

- `src/hooks/useSessionPayments.ts` — montagem do pagamento + resolução no `refundPayment`.
- `src/types/sessionPayments.ts` — campos opcionais `cobrancaId` / `parcelaId`.
- `supabase/functions/gestao-asaas-refund/index.ts` — fallback via `cobranca_parcelas` e seleção de ambiente.

Sem migração de banco. Nenhum registro financeiro existente é alterado.
