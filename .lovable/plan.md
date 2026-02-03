
# Plano: Corrigir Modal de Cobranca Sem Afetar o Gallery

## Arquitetura Atual (Isolamento ja Existente)

A separacao entre Gestao e Gallery JA EXISTE e esta correta:

| Projeto | Edge Function | Autenticacao | Deteccao Provedor |
|---------|--------------|--------------|-------------------|
| **Gallery** | `gallery-create-payment` | Service Role | Automatica (busca do fotografo) |
| **Gestao** | `gestao-infinitepay-create-link` | JWT | Explicita (usuario logado) |
| **Gestao** | `mercadopago-create-link` | JWT | Explicita (usuario logado) |

O Gallery NAO sera afetado pelas mudancas, pois usa uma Edge Function completamente separada.

---

## Problema Identificado no Gestao

O hook `useCobranca.ts` tem a funcao `getActivePaymentProvider()` que usa `.single()`:

```typescript
const { data } = await supabase
  .from('usuarios_integracoes')
  .in('provedor', ['mercadopago', 'infinitepay'])
  .single();  // ERRO quando ha 2+ provedores ativos!
```

Quando o usuario tem Mercado Pago E InfinitePay ativos, retorna erro e `data = null`.

Alem disso, o `createLinkCharge()` NAO recebe qual provedor o usuario selecionou no modal - ele tenta detectar automaticamente (e falha).

---

## Solucao Proposta

### Modificacao 1: Remover `getActivePaymentProvider()` do Hook

Esta funcao nao e mais necessaria porque o ProviderSelector ja carrega os provedores ativos e o usuario seleciona qual usar.

### Modificacao 2: `createLinkCharge()` Recebe o Provedor Explicitamente

```typescript
// Novo parametro no request
interface CreateCobrancaRequest {
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
  tipoCobranca: TipoCobranca;
  provedor?: 'mercadopago' | 'infinitepay' | 'pix_manual';  // NOVO
}

// Uso no createLinkCharge
const createLinkCharge = async (request: CreateCobrancaRequest): Promise<CobrancaResponse> => {
  // Provedor vem do modal, NAO mais do banco
  const provedor = request.provedor;
  
  if (!provedor || provedor === 'pix_manual') {
    // PIX Manual nao gera link - tratado separadamente
    throw new Error('Selecione um provedor de pagamento');
  }

  let response;
  if (provedor === 'infinitepay') {
    response = await supabase.functions.invoke('gestao-infinitepay-create-link', { ... });
  } else {
    response = await supabase.functions.invoke('mercadopago-create-link', { ... });
  }
  // ...
};
```

### Modificacao 3: ChargeModal Passa o Provedor na Chamada

```typescript
const handleGenerateCharge = async () => {
  if (!selectedProvider) return;

  // Determinar o provedor real para a Edge Function
  const provedor = selectedProvider === 'infinitepay' ? 'infinitepay' : 'mercadopago';

  const result = await createLinkCharge({
    clienteId,
    sessionId,
    valor,
    descricao: descricao || undefined,
    tipoCobranca: 'link',
    provedor,  // NOVO: passa o provedor selecionado
  });
};
```

### Modificacao 4: Remover Opcao PIX Duplicada do ProviderSelector

Remover `pix_mercadopago` da lista. O PIX do Mercado Pago ja aparece dentro do checkout do link.

**Antes:**
- PIX (Mercado Pago) - Confirmacao automatica
- Mercado Pago - Pix + Cartao ate 12x
- InfinitePay - Pix + Cartao
- PIX Manual - Confirmacao manual

**Depois:**
- Mercado Pago - Pix + Cartao ate 12x
- InfinitePay - Pix + Cartao
- PIX Manual - Confirmacao manual

### Modificacao 5: Atualizar Tipo ProvedorPagamento

Adicionar `pix_manual` ao tipo para compatibilidade:

```typescript
export type ProvedorPagamento = 'mercadopago' | 'infinitepay' | 'pix_manual';
```

---

## Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/hooks/useCobranca.ts` | Remover `getActivePaymentProvider()`, atualizar `createLinkCharge()` para receber provedor |
| `src/types/cobranca.ts` | Adicionar `pix_manual` ao tipo, adicionar `provedor` ao CreateCobrancaRequest |
| `src/components/cobranca/ChargeModal.tsx` | Passar provedor na chamada de `createLinkCharge()` |
| `src/components/cobranca/ProviderSelector.tsx` | Remover opcao `pix_mercadopago` duplicada |
| `src/components/cobranca/ProviderRow.tsx` | Atualizar tipo `SelectedProvider` |

---

## O Que NAO Sera Tocado

| Arquivo | Motivo |
|---------|--------|
| `supabase/functions/gallery-create-payment/index.ts` | Edge Function exclusiva do Gallery |
| `supabase/functions/infinitepay-webhook/index.ts` | Webhook compartilhado (ja funciona) |
| `supabase/functions/mercadopago-webhook/index.ts` | Webhook compartilhado (ja funciona) |
| `supabase/functions/check-payment-status/index.ts` | Fallback compartilhado (ja funciona) |

---

## Fluxo Corrigido

```text
1. Usuario abre ChargeModal no Gestao
2. ProviderSelector carrega provedores ATIVOS (sem duplicatas)
3. Lista exibe:
   - Mercado Pago (pix + cartao no checkout)
   - InfinitePay (pix + cartao)
   - PIX Manual (se configurado)
4. Usuario seleciona provedor (ex: InfinitePay)
5. Usuario clica "Gerar Link"
6. ChargeModal chama createLinkCharge({ ..., provedor: 'infinitepay' })
7. Hook roteia para gestao-infinitepay-create-link (isolado do Gallery)
8. Link gerado com sucesso!
```

---

## Garantia de Isolamento

O Gallery continuara funcionando porque:

1. **Usa Edge Function diferente**: `gallery-create-payment` (nao tocada)
2. **Usa Service Role**: Nao depende de JWT do fotografo
3. **Detecta provedor automaticamente**: Busca do banco qual provedor o fotografo usa
4. **Webhooks compartilhados**: `infinitepay-webhook` e `mercadopago-webhook` processam pagamentos de ambos projetos

As modificacoes no Gestao afetam APENAS:
- O hook `useCobranca.ts` (usado so pelo Gestao)
- Os componentes em `src/components/cobranca/` (usados so pelo Gestao)

---

## Resumo das Mudancas

1. **Tipo**: Adicionar `pix_manual` e `provedor` ao request
2. **Hook**: Remover funcao problematica, receber provedor explicitamente
3. **Modal**: Passar provedor selecionado para o hook
4. **Selector**: Remover PIX duplicado do Mercado Pago

Resultado: Modal funciona com multiplos provedores ativos, sem afetar o Gallery.
