
# Plano de Correção: Sincronização Pacote Workflow → Agenda e Retorno de Pagamento Gallery

## Problema 1: Agenda não reflete mudança de pacote do Workflow

### Diagnóstico Técnico

O problema foi identificado através da consulta SQL:

```
appointment_package_id: ce7313d9-1ce1-4b07-a9c8-c0e8bf886853 (ID do pacote "Teste")
session_pacote: "Gest. Estúdio 10f" (atualizado corretamente)
```

**Causa Raiz:** O Workflow atualiza a tabela `clientes_sessoes`, mas **não propaga a alteração para a tabela `appointments`**. A Agenda lê o `package_id` diretamente de `appointments`, que permanece com o valor antigo.

### Arquitetura Atual (incompleta)

```text
┌─────────────────────────────────────────────────────────────────┐
│                        WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────┤
│  useWorkflowRealtime.ts → updateSession()                       │
│                                                                 │
│  Atualiza clientes_sessoes:                                     │
│  ├─ pacote (nome) ✅                                            │
│  ├─ categoria (nome) ✅                                         │
│  ├─ regras_congeladas ✅                                        │
│  └─ valor_base_pacote ✅                                        │
│                                                                 │
│  ❌ NÃO ATUALIZA appointments.package_id                        │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AGENDA                                    │
├─────────────────────────────────────────────────────────────────┤
│  UnifiedEventCard.tsx → getPackageInfo()                        │
│                                                                 │
│  Lê de appointments:                                            │
│  ├─ package_id → Busca em pacotes[] (PRIORIDADE)                │
│  └─ type → Fallback (nome antigo)                               │
│                                                                 │
│  ❌ EXIBE PACOTE ANTIGO porque package_id não foi atualizado    │
└─────────────────────────────────────────────────────────────────┘
```

### Solução Proposta

Adicionar sincronização Workflow → Appointments após atualização de pacote em `useWorkflowRealtime.ts`.

**Localização:** Após a linha 630, onde o update em `clientes_sessoes` é executado com sucesso.

**Lógica:**
```typescript
// Após update bem-sucedido em clientes_sessoes
if (sanitizedUpdates.pacote && currentSession?.appointment_id) {
  const pkg = packages.find(p => p.nome === sanitizedUpdates.pacote);
  if (pkg) {
    await supabase
      .from('appointments')
      .update({
        package_id: pkg.id,
        type: sanitizedUpdates.categoria || currentSession.categoria,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSession.appointment_id);
    
    console.log('📅 [SYNC] Appointment package_id atualizado:', pkg.id);
  }
}
```

### Campos a Atualizar no appointments

| Campo | Valor | Descrição |
|-------|-------|-----------|
| `package_id` | UUID do novo pacote | Usado pela Agenda para exibir nome do pacote |
| `type` | Nome da categoria | Campo texto de fallback (exibido como "tipo de sessão") |
| `updated_at` | timestamp | Controle de versão |

---

## Problema 2: Gallery não recebe confirmação de pagamento

### Fluxo Técnico Atual (já implementado no Gestão)

```text
┌─────────────────────────────────────────────────────────────────┐
│              GALLERY → CRIA COBRANÇA                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  gallery-create-payment (Edge Function)                         │
│  ├─ Recebe: sessionId (texto), clienteId, valor                 │
│  ├─ Cria registro em cobrancas (status='pendente')              │
│  ├─ Chama InfinitePay API                                       │
│  └─ Retorna: checkoutUrl para redirecionamento                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Cliente paga no checkout InfinitePay
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              INFINITEPAY → WEBHOOK                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  infinitepay-webhook (Edge Function)                            │
│  ├─ Recebe: order_nsu (= cobranca.id), paid_amount              │
│  ├─ Atualiza cobrancas SET status='pago', data_pagamento=now    │
│  ├─ Cria registro em clientes_transacoes                        │
│  └─ Trigger recompute_session_paid atualiza valor_pago          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Como o Gallery DEVE verificar pagamento

O Gallery tem **duas opções** para confirmar pagamento:

**Opção A: Polling na tabela `cobrancas` (Recomendado para UI simples)**

```typescript
// No Gallery - após redirecionar cliente para checkout
async function verificarPagamento(cobrancaId: string): Promise<boolean> {
  const { data } = await supabase
    .from('cobrancas')
    .select('status, valor, data_pagamento')
    .eq('id', cobrancaId)
    .single();
  
  return data?.status === 'pago';
}

// Usar em intervalo
const pollInterval = setInterval(async () => {
  const pago = await verificarPagamento(cobrancaId);
  if (pago) {
    clearInterval(pollInterval);
    // Exibir confirmação para o cliente
    showPaymentSuccessMessage();
    // Atualizar status da galeria
    await updateGalleryStatus(galeriaId, 'pago');
  }
}, 3000); // Verificar a cada 3 segundos
```

**Opção B: Real-time subscription (Melhor UX)**

```typescript
// No Gallery - escutar mudanças em tempo real
const subscription = supabase
  .channel('cobranca-payment')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'cobrancas',
      filter: `id=eq.${cobrancaId}`
    },
    (payload) => {
      if (payload.new.status === 'pago') {
        // Pagamento confirmado!
        showPaymentSuccessMessage();
        updateGalleryStatus(galeriaId, 'pago');
        subscription.unsubscribe();
      }
    }
  )
  .subscribe();
```

**Opção C: Verificar via session_id (para galleries vinculadas)**

```typescript
// Se a galeria tem session_id vinculado
async function verificarPagamentoSessao(sessionId: string): Promise<{pago: boolean, valorPago: number}> {
  const { data } = await supabase
    .from('clientes_sessoes')
    .select('valor_pago, valor_total')
    .or(`session_id.eq.${sessionId},id.eq.${sessionId}`)
    .single();
  
  return {
    pago: data?.valor_pago >= data?.valor_total,
    valorPago: data?.valor_pago || 0
  };
}
```

### Diagrama do Fluxo Completo

```text
┌─────────────────────────────────────────────────────────────────┐
│                        GALLERY                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Cliente seleciona fotos extras (8 fotos × R$21 = R$168)     │
│                                                                 │
│  2. Chama: gallery-create-payment                               │
│     body: {                                                     │
│       sessionId: "workflow-xxx",  // Vínculo com Gestão         │
│       clienteId: "uuid-cliente",                                │
│       valor: 168.00,                                            │
│       descricao: "8 fotos extras"                               │
│     }                                                           │
│                                                                 │
│  3. Recebe: { success: true, checkoutUrl: "https://..." }       │
│                                                                 │
│  4. Redireciona cliente para checkoutUrl                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CHECKOUT INFINITEPAY                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Cliente paga (Pix, Cartão, etc.)                               │
│                                                                 │
│  Após pagamento confirmado:                                     │
│  → InfinitePay envia webhook para infinitepay-webhook           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INFINITEPAY-WEBHOOK                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  • Atualiza cobrancas.status = 'pago'                           │
│  • Cria clientes_transacoes com valor e session_id              │
│  • Trigger recompute_session_paid → valor_pago atualizado       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                GALLERY DETECTA PAGAMENTO                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Via: subscription em 'cobrancas' WHERE id = cobrancaId         │
│  OU: polling em 'cobrancas' a cada 3s                           │
│                                                                 │
│  Quando status = 'pago':                                        │
│  • Exibir mensagem de sucesso                                   │
│  • Atualizar status da galeria                                  │
│  • Liberar download ou próxima etapa                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resumo das Alterações

### No Gestão (este projeto)

| Arquivo | Alteração | Descrição |
|---------|-----------|-----------|
| `src/hooks/useWorkflowRealtime.ts` | Adicionar sync Workflow → Appointments | Atualizar `package_id` e `type` na tabela `appointments` após mudança de pacote |

### Instruções para o Gallery

O Gallery deve implementar **verificação de pagamento** usando uma das três opções:

1. **Polling** na tabela `cobrancas` (mais simples)
2. **Real-time subscription** em `cobrancas` (melhor UX)
3. **Verificar `valor_pago`** em `clientes_sessoes` (para galerias vinculadas)

**Importante:** O Gallery NÃO precisa implementar webhook próprio. O `infinitepay-webhook` do Gestão já processa todos os pagamentos e atualiza as tabelas compartilhadas.

---

## Próximos Passos

1. **Implementar correção no useWorkflowRealtime.ts** - Adicionar sync para appointments após mudança de pacote
2. **Testar fluxo** - Mudar pacote no Workflow → Verificar se Agenda atualiza
3. **Documentar para Gallery** - Enviar instruções de como verificar pagamento via Supabase
