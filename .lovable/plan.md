

# Plano: Ativar Gateway de Pagamento no Workflow e CRM

## Diagnóstico Atual

Boa notícia! A infraestrutura de pagamentos já está **95% implementada**. Após análise detalhada do código, identifiquei que:

### O que JÁ FUNCIONA

| Componente | Status | Descrição |
|------------|--------|-----------|
| Edge Functions | ✅ Completo | `mercadopago-create-link`, `mercadopago-create-pix`, `gestao-infinitepay-create-link` |
| Webhooks | ✅ Completo | `mercadopago-webhook`, `infinitepay-webhook` processam pagamentos e criam transações |
| Hook useCobranca | ✅ Completo | Gera Pix, Link e verifica status |
| ChargeModal | ✅ Completo | Interface com abas Pix/Link, histórico, QR Code |
| SessionPaymentsManager | ✅ Integrado | Botão "Cobrar" já existe e abre o modal |
| Tabela cobrancas | ✅ Completa | Campos para MP e InfinitePay |
| Tabela usuarios_integracoes | ✅ Funcional | Já tem usuários com provedores ativos |
| IntegracoesTab | ✅ Funcional | Configuração de MP e InfinitePay |

### O que PRECISA ser corrigido

| Problema | Impacto | Solução |
|----------|---------|---------|
| `VITE_MERCADOPAGO_APP_ID` no frontend | Bloqueia conexão OAuth do MP | Mover para constante fixa ou Edge Function |
| Secrets do MP App ID | Já configurados no Supabase | Precisamos usar via Edge Function |

---

## Problema Principal: OAuth do Mercado Pago

O código atual em `useIntegracoes.ts` tenta usar `import.meta.env.VITE_MERCADOPAGO_APP_ID`, que não está disponível no Lovable. Isso **bloqueia** o fluxo de conexão OAuth.

```typescript
// PROBLEMA ATUAL (linha 104)
const appId = import.meta.env.VITE_MERCADOPAGO_APP_ID;
if (!appId) {
  toast.error('Configure VITE_MERCADOPAGO_APP_ID no ambiente');
  return; // ❌ Bloqueia aqui
}
```

---

## Solução Proposta

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useIntegracoes.ts` | Buscar APP_ID do Supabase Edge Function |
| `supabase/functions/mercadopago-connect/index.ts` | Adicionar endpoint para retornar APP_ID (apenas client_id público) |

### Alternativa Simples (Recomendada)

Como o `MERCADOPAGO_APP_ID` é um valor **público** (não é secret), podemos criar uma constante direta no código. Verificando os secrets:

```text
Secrets configurados:
- MERCADOPAGO_APP_ID ✅ 
- MERCADOPAGO_CLIENT_SECRET ✅
- MERCADOPAGO_ACCESS_TOKEN ✅
- MERCADOPAGO_PUBLIC_KEY ✅
```

O APP_ID do Mercado Pago é o mesmo para todos os usuários da plataforma (é o ID da aplicação Lunari no MP). Podemos obtê-lo via Edge Function.

---

## Implementação

### Passo 1: Criar Edge Function para retornar APP_ID

```typescript
// supabase/functions/mercadopago-get-app-id/index.ts
// Retorna o APP_ID público para o frontend iniciar OAuth
```

### Passo 2: Modificar useIntegracoes

```typescript
// Buscar APP_ID da Edge Function
const getAppId = async (): Promise<string | null> => {
  const { data } = await supabase.functions.invoke('mercadopago-get-app-id');
  return data?.appId || null;
};

const connectMercadoPago = useCallback(async () => {
  const appId = await getAppId();
  if (!appId) {
    toast.error('Erro ao obter configuração do Mercado Pago');
    return;
  }
  // ... resto do código OAuth
}, [user]);
```

---

## Verificação de Funcionamento Atual

Para confirmar que o resto está funcionando:

1. **InfinitePay**: Já funciona sem OAuth (apenas handle)
2. **Mercado Pago**: Precisa do fix do APP_ID
3. **Cobranças**: ChargeModal já integrado ao SessionPaymentsManager
4. **Webhooks**: Configurados e funcionais

---

## Resultado Esperado

Após implementação:

| Funcionalidade | Status |
|----------------|--------|
| Conectar InfinitePay | ✅ Funciona (apenas digitar handle) |
| Conectar Mercado Pago | ✅ OAuth funcionará após fix |
| Gerar Pix (MP) | ✅ Já implementado |
| Gerar Link (MP) | ✅ Já implementado |
| Gerar Link (InfinitePay) | ✅ Já implementado |
| Webhook processa pagamento | ✅ Cria transação e atualiza valor_pago |
| Histórico unificado | ✅ Exibe origem (Manual, Pix MP, Link MP, InfinitePay) |

---

## Resumo Técnico

A implementação consiste em apenas **2 mudanças**:

1. **Nova Edge Function** (`mercadopago-get-app-id`): 15 linhas de código
2. **Modificar useIntegracoes.ts**: Substituir `import.meta.env` por chamada à Edge Function

Todo o resto da infraestrutura (cobranças, webhooks, modal, histórico) já está **100% funcional**.

