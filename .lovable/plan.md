

# Plano: Correção de Atualização de Pacote no Workflow e Integração Gallery

## Diagnóstico do Problema

### Problema 1: Pacote não atualizado no banco de dados

**Evidência:**
```sql
-- Consulta realizada na sessão a5c87748-6ab6-4277-842e-e1db48d07900
pacote: "Smash 10f"  -- ❌ ANTIGO
categoria: "Smash"   -- ❌ ANTIGO
regras_congeladas.pacote.nome: "Teste"  -- ✅ NOVO (congelado corretamente)
regras_congeladas.pacote.categoria: "Teste"  -- ✅ NOVO
```

**Causa Raiz:**
O fluxo de atualização de pacote no `useWorkflowRealtime.ts` está executando corretamente o congelamento das regras (`regras_congeladas`), mas há uma condição que pode estar impedindo o UPDATE do campo `pacote` e `categoria` no banco de dados.

**Análise Detalhada:**
1. `WorkflowCardCollapsed` chama `onFieldUpdate(session.id, 'pacote', packageData.id)`
2. `useWorkflowRealtime.updateSession` processa o campo `pacote`:
   - Busca pacote via `configurationService.loadPacotesAsync()`
   - Define `sanitizedUpdates.pacote = pkg.nome`
   - Define `sanitizedUpdates.categoria = cat.nome`
   - Congela regras corretamente
3. **PROBLEMA POTENCIAL**: O diff check na linha 590-608 pode estar falhando em detectar mudanças ou o UPDATE não está sendo executado

**Verificação adicional necessária:**
O campo `pacote` na sessão **em cache** pode já estar mostrando o novo valor, fazendo o diff check retornar "sem mudanças", enquanto o banco ainda tem o valor antigo.

---

## Correções Necessárias

### FASE 1: Correção do fluxo de atualização de pacote

**Arquivo:** `src/hooks/useWorkflowRealtime.ts`

**Problema:** O diff check compara contra `currentSession` que vem do cache local, não do banco. Se o cache já foi atualizado otimisticamente, o diff retorna "sem mudanças".

**Solução:** Garantir que o UPDATE sempre execute quando `regras_congeladas` é modificado, já que isso indica uma mudança real de pacote.

```typescript
// Linha ~593 - Adicionar regras_congeladas ao check de forma mais robusta
const fieldsToCheck = ['pacote', 'valor_total', 'valor_pago', 'qtd_fotos_extra', 
                       'valor_foto_extra', 'valor_total_foto_extra', 'produtos_incluidos', 
                       'categoria', 'descricao', 'status', 'regras_congeladas', 
                       'desconto', 'valor_adicional', 'observacoes', 'detalhes'];

// CORREÇÃO: Forçar update quando pacote mudou (regras_congeladas indica mudança real)
if (sanitizedUpdates.regras_congeladas) {
  hasChanges = true; // Regras congeladas sempre indica mudança real
}
```

### FASE 2: Garantir persistência atômica de pacote e categoria

**Arquivo:** `src/hooks/useWorkflowRealtime.ts` (linhas 304-384)

**Melhoria:** Adicionar log de debug e verificação após o UPDATE

```typescript
// Após linha 378, adicionar verificação
if (sanitizedUpdates.pacote && sanitizedUpdates.pacote !== currentSession?.pacote) {
  console.log('🔄 PACOTE MUDOU:', currentSession?.pacote, '→', sanitizedUpdates.pacote);
}
```

---

## Parte 2: Como o Gallery pode modificar valores de fotos extras

### Arquitetura de Sincronização

```
┌─────────────────────────────────────────────────────────────────┐
│                    GALLERY PROJECT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Cliente seleciona fotos → Calcula fotos extras → Confirma     │
│                                                                 │
│  Ao confirmar seleção:                                          │
│  1. Atualiza qtd_fotos_extra diretamente na sessão              │
│  2. Cria cobrança via gallery-create-payment                    │
│  3. Redireciona para checkout InfinitePay/MercadoPago           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BANCO DE DADOS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  clientes_sessoes:                                              │
│  ├─ qtd_fotos_extra (int)                                       │
│  ├─ valor_foto_extra (numeric) - preço unitário                 │
│  ├─ valor_total_foto_extra (numeric) - total fotos extras       │
│  ├─ valor_total (numeric) - calculado via trigger               │
│  ├─ valor_pago (numeric) - atualizado via trigger de transações │
│  └─ regras_congeladas (jsonb) - regras de precificação          │
│                                                                 │
│  Trigger: recalculate_fotos_extras_total                        │
│  - Executado quando qtd_fotos_extra ou valor_foto_extra muda    │
│  - Recalcula valor_total_foto_extra = qtd × valor_unitário      │
│                                                                 │
│  Trigger: recalculate_valor_total                               │
│  - Executado quando valor_total_foto_extra muda                 │
│  - Recalcula valor_total da sessão inteira                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementação no Gallery

O Gallery deve atualizar diretamente a tabela `clientes_sessoes` com os valores calculados:

```typescript
// No Gallery - ao confirmar seleção de fotos

async function updateSessionExtraPhotos(params: {
  sessionId: string;        // Formato texto: "workflow-xxx"
  sessionUuid: string;      // UUID da sessão
  qtdFotosExtra: number;
  valorFotoExtra: number;   // Preço unitário já calculado com desconto
  valorTotalFotoExtra: number; // Total calculado
}) {
  // Opção 1: UPDATE direto via Supabase (requer service role ou RLS permitir)
  const { error } = await supabase
    .from('clientes_sessoes')
    .update({
      qtd_fotos_extra: params.qtdFotosExtra,
      valor_foto_extra: params.valorFotoExtra,
      valor_total_foto_extra: params.valorTotalFotoExtra,
      // NÃO atualizar valor_total - trigger faz isso
      updated_at: new Date().toISOString()
    })
    .or(`id.eq.${params.sessionUuid},session_id.eq.${params.sessionId}`);

  if (error) {
    console.error('Erro ao atualizar fotos extras:', error);
    throw error;
  }
}
```

### Considerações de Segurança (RLS)

O Gallery precisa de uma das seguintes abordagens:

**Opção A - Edge Function intermediária (RECOMENDADO):**
Criar `gallery-update-session-photos` que usa Service Role para atualizar a sessão.

**Opção B - RLS Policy específica:**
Criar policy que permite UPDATE limitado em clientes_sessoes para campos específicos.

### Resumo de Campos que o Gallery pode/deve modificar

| Campo | Pode Modificar | Via |
|-------|----------------|-----|
| `qtd_fotos_extra` | ✅ Sim | UPDATE direto ou Edge Function |
| `valor_foto_extra` | ✅ Sim | Calculado com descontos progressivos |
| `valor_total_foto_extra` | ✅ Sim | qtd × valor unitário |
| `valor_total` | ❌ Não | Trigger automático |
| `valor_pago` | ❌ Não | Trigger de transações |
| `status_galeria` | ✅ Sim | Status da galeria na sessão |

---

## Resumo das Correções

| Arquivo | Problema | Correção |
|---------|----------|----------|
| `src/hooks/useWorkflowRealtime.ts` | Diff check pode ignorar mudanças de pacote | Forçar `hasChanges = true` quando `regras_congeladas` é atualizado |
| `supabase/functions/gallery-update-session` | Não existe | Criar Edge Function para Gallery atualizar fotos extras |

## Próximos Passos

1. **Correção imediata**: Forçar UPDATE quando regras_congeladas mudar
2. **Criar Edge Function**: `gallery-update-session-photos` para Gallery
3. **Testar fluxo completo**: Mudar pacote → verificar banco → confirmar sincronização

