

# Plano: Separar Sistema de Cobrança do Gestão

## Diagnóstico do Problema

O erro `userId: undefined` nos logs indica que a Edge Function `infinitepay-create-link` no servidor tem código diferente do repositório. Isso sugere que o projeto Gallery sobrescreveu a função com uma versão que espera `userId` no corpo da requisição:

```
ERROR Missing required fields: {
  clienteId: "e17352ae-309b-4e4f-ae56-3371b3272265",
  valor: 200,
  userId: undefined  ← Esperando no body, não extrai do JWT
}
```

**Código no repositório atual**:
- Extrai `userId` via JWT (`supabase.auth.getUser(token)`) - linha 37
- **Não** espera `userId` no body
- **Não** tem mensagem "Missing required fields" no formato do log

Isso confirma que o Gallery deployou uma versão diferente, quebrando o fluxo do Gestão.

---

## Solução: Criar Função Exclusiva para Gestão

Criar uma nova Edge Function `gestao-infinitepay-create-link` que:
1. Seja 100% isolada do Gallery
2. Use autenticação JWT (padrão do Gestão)
3. Siga todas as regras do Contrato Oficial de Cobranças

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/gestao-infinitepay-create-link/index.ts` | **CRIAR** | Nova função exclusiva para Gestão |
| `supabase/config.toml` | Modificar | Adicionar configuração da nova função |
| `src/hooks/useCobranca.ts` | Modificar | Apontar para nova função |

---

## Detalhes Técnicos

### 1. Nova Edge Function: `gestao-infinitepay-create-link`

```typescript
// Estrutura da nova função (idêntica à versão atual, mas com prefixo gestao-)

interface CreateLinkRequest {
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
}

serve(async (req) => {
  // 1. Validar JWT e extrair userId
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Não autorizado");
  
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  const userId = user.id;
  
  // 2. Receber parâmetros do body
  const { clienteId, sessionId, valor, descricao } = await req.json();
  
  // 3. Normalizar session_id (texto)
  // 4. Buscar handle InfinitePay do usuário
  // 5. Criar cobrança no banco
  // 6. Chamar API InfinitePay
  // 7. Retornar checkoutUrl
});
```

**Diferenças importantes**:
- Nome com prefixo `gestao-` para evitar conflitos
- Mantém autenticação via JWT (não aceita `userId` no body)
- Será controlada exclusivamente pelo Gestão

### 2. Atualizar config.toml

```toml
[functions.gestao-infinitepay-create-link]
verify_jwt = false
```

### 3. Atualizar useCobranca.ts

```typescript
// Linha 151: Mudar de 'infinitepay-create-link' para 'gestao-infinitepay-create-link'
if (provedor === 'infinitepay') {
  response = await supabase.functions.invoke('gestao-infinitepay-create-link', {
    body: {
      clienteId: request.clienteId,
      sessionId: request.sessionId,
      valor: request.valor,
      descricao: request.descricao,
    },
  });
}
```

---

## Fluxo de Funcionamento

```
┌─────────────────────────────────────────────────────────────────┐
│                        SEPARAÇÃO DE FLUXOS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GESTÃO (Workflow/CRM)          │  GALLERY (Projeto Externo)    │
│  ─────────────────────          │  ─────────────────────────    │
│  useCobranca.ts                 │  gallery-create-payment       │
│       │                         │       │                       │
│       ▼                         │       ▼                       │
│  gestao-infinitepay-create-link │  (já existente, não muda)     │
│  • Exige JWT                    │  • Service Role               │
│  • Extrai userId do token       │  • Recebe photographerId      │
│       │                         │       │                       │
│       ▼                         │       ▼                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 WEBHOOK COMPARTILHADO                    │   │
│  │             infinitepay-webhook (não muda)              │   │
│  │    • Busca por ip_order_nsu primeiro                    │   │
│  │    • Fallback por id                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Compatibilidade Garantida

| Item | Status |
|------|--------|
| Gestão usa `gestao-infinitepay-create-link` | ✅ Isolado |
| Gallery usa `gallery-create-payment` | ✅ Não afetado |
| Webhook compartilhado | ✅ Funciona para ambos |
| Cobranças existentes | ✅ Compatíveis |
| Contrato Oficial InfinitePay | ✅ Mantido |

---

## Resultado Esperado

Após a implementação:
1. **Gestão**: Gera links via `gestao-infinitepay-create-link` (exige JWT)
2. **Gallery**: Continua usando `gallery-create-payment` (Service Role)
3. **Webhook**: Único para ambos (`infinitepay-webhook`)
4. **Independência**: Deploys do Gallery não afetam mais o Gestão

