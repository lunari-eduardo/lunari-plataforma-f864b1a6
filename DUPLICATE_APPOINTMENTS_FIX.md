# Resolução de Duplicatas - Appointments e Sessões

## 🎯 Problema Identificado

Agendamentos estavam sendo duplicados devido a:
1. **Race conditions** na criação de sessões
2. **Múltiplas subscriptions** realtime para a mesma tabela
3. **Tentativa incorreta** de modificar ID após criação
4. **Falta de constraints** no banco de dados
5. **Sincronização múltipla** de appointments existentes

---

## ✅ Soluções Implementadas

### FASE 1: Database Constraints ✅
**Arquivo:** Migration SQL

Adicionados constraints para prevenir duplicatas no nível do banco:

```sql
-- Appointments
ALTER TABLE appointments ADD CONSTRAINT unique_user_date_time UNIQUE (user_id, date, time);
CREATE UNIQUE INDEX unique_appointment_session_id ON appointments(user_id, session_id) 
  WHERE session_id IS NOT NULL AND session_id != '';

-- Clientes Sessões  
CREATE UNIQUE INDEX unique_session_appointment_id ON clientes_sessoes(user_id, appointment_id) 
  WHERE appointment_id IS NOT NULL;
ALTER TABLE clientes_sessoes ADD CONSTRAINT unique_clientes_sessoes_session_id 
  UNIQUE (user_id, session_id);
```

**Resultado:** Banco rejeita automaticamente tentativas de duplicação.

---

### FASE 2: Consolidação de Realtime ✅
**Status:** Verificado - apenas `useAppointmentWorkflowSync` está fazendo subscriptions

- ✅ `useAppointmentWorkflowSync`: mantém subscription para criar sessões
- ✅ `AgendaContext`: não tem subscription redundante de appointments
- ✅ Não há conflitos de subscriptions

---

### FASE 3: Lock para Criação de Sessões ✅
**Arquivo:** `src/services/WorkflowSupabaseService.ts`

Implementado mecanismo de lock para prevenir race conditions:

```typescript
private static creationLocks: Map<string, Promise<any>> = new Map();

static async createSessionFromAppointment(appointmentId: string, appointmentData: any) {
  // Verificar se já está sendo criada
  const existingLock = this.creationLocks.get(appointmentId);
  if (existingLock) {
    return existingLock; // Retorna promise existente
  }

  // Criar lock
  const creationPromise = this._createSessionInternal(appointmentId, appointmentData);
  this.creationLocks.set(appointmentId, creationPromise);

  try {
    return await creationPromise;
  } finally {
    setTimeout(() => this.creationLocks.delete(appointmentId), 5000);
  }
}
```

**Resultado:** Múltiplas chamadas simultâneas usam a mesma promise de criação.

---

### FASE 4: Correção do useIntegration ✅
**Arquivo:** `src/hooks/useIntegration.ts`

Mudanças implementadas:

1. **Removido código problemático:**
   ```typescript
   // ❌ REMOVIDO: Tentativa de modificar ID (UUID imutável)
   // await updateAppointment(appointment.id, { 
   //   id: `orcamento-${orcamento.id}`
   // });
   ```

2. **Adicionado rastreamento de orçamentos processados:**
   ```typescript
   const createdAppointmentsRef = useRef<Set<string>>(new Set());
   
   // Antes de criar:
   if (createdAppointmentsRef.current.has(orcamento.id)) {
     return; // Já criado nesta sessão
   }
   
   // Após criar:
   createdAppointmentsRef.current.add(orcamento.id);
   ```

3. **Adicionado logging estruturado:**
   ```typescript
   console.log('🔵 [APPOINTMENT-CREATE]', {
     orcamentoId: orcamento.id,
     source: 'useIntegration',
     timestamp: new Date().toISOString()
   });
   ```

**Resultado:** Cada orçamento gera apenas 1 appointment por sessão.

---

### FASE 5: Sincronização Única de Appointments ✅
**Arquivos:** 
- `src/hooks/useAppointmentWorkflowSync.ts`
- `src/hooks/useWorkflowCacheInit.ts`

**Mudanças:**

1. **Removido sync com delay do `useAppointmentWorkflowSync`:**
   ```typescript
   // ❌ REMOVIDO:
   // setTimeout(syncExistingAppointments, 3000);
   ```

2. **Movido para `useWorkflowCacheInit` com controle de sessão:**
   ```typescript
   const hasSyncedThisSession = sessionStorage.getItem('appointments_synced_session');
   if (!hasSyncedThisSession) {
     await syncExistingAppointments();
     sessionStorage.setItem('appointments_synced_session', 'true');
   }
   ```

**Resultado:** Sync executa apenas 1x por login, não mais a cada render.

---

## 📊 Comparação Antes/Depois

| Métrica | Antes | Depois |
|---------|-------|--------|
| Duplicatas de appointments | ✗ Possíveis | ✅ Bloqueadas por constraint |
| Duplicatas de sessões | ✗ Possíveis | ✅ Bloqueadas por lock + constraint |
| Sync de appointments | 🔄 Múltiplo | ✅ Único (por sessão) |
| Race conditions | ⚠️ Sim | ✅ Resolvidas |
| Tentativa de modificar ID | ❌ Sim (error) | ✅ Removida |

---

## 🧪 Testes Necessários

### 1. Teste de Constraint (Data/Hora)
```
✅ Criar appointment às 10:00 de 2025-01-15
❌ Tentar criar outro às 10:00 de 2025-01-15 → Erro de constraint
```

### 2. Teste de Lock (Race Condition)
```
✅ Confirmar appointment em 2 abas simultaneamente
✅ Apenas 1 sessão deve ser criada
✅ Console mostra "Session creation already in progress"
```

### 3. Teste de Orçamento Fechado
```
✅ Fechar orçamento → 1 appointment criado
✅ Recarregar página → Não cria duplicata
✅ Abrir em outra aba → Não cria duplicata
```

### 4. Teste de Sync Única
```
✅ Fazer login → Sync executa 1x
✅ Navegar para Workflow → Não executa sync novamente
✅ Fazer logout e login → Sync executa novamente
```

---

## 🔍 Monitoramento

### Logs para Observar

**Criação com Lock:**
```
⏳ [WorkflowService] Session creation already in progress for: <id>
```

**Appointment de Orçamento:**
```
🔵 [APPOINTMENT-CREATE] { orcamentoId, source: 'useIntegration', timestamp }
```

**Sync Única:**
```
🔄 [WorkflowCacheInit] Syncing existing appointments...
✅ [WorkflowCacheInit] Appointments sync completed
```

### Verificação de Duplicatas no Banco

```sql
-- Verificar appointments duplicados
SELECT user_id, date, time, COUNT(*) 
FROM appointments 
GROUP BY user_id, date, time 
HAVING COUNT(*) > 1;

-- Verificar sessões duplicadas
SELECT user_id, session_id, COUNT(*) 
FROM clientes_sessoes 
GROUP BY user_id, session_id 
HAVING COUNT(*) > 1;
```

---

## 🛠️ Próximos Passos Recomendados

### 1. Limpeza de Dados (Manual)
```sql
-- Backup
CREATE TABLE appointments_backup AS SELECT * FROM appointments;
CREATE TABLE clientes_sessoes_backup AS SELECT * FROM clientes_sessoes;
CREATE TABLE clientes_transacoes_backup AS SELECT * FROM clientes_transacoes;

-- Limpar (se necessário)
TRUNCATE clientes_transacoes CASCADE;
TRUNCATE clientes_sessoes CASCADE;
TRUNCATE appointments CASCADE;
```

### 2. Re-popular
- Fechar orçamentos novamente
- Verificar que apenas 1 appointment é criado por orçamento
- Confirmar appointments manualmente
- Verificar que apenas 1 sessão é criada por appointment

### 3. Validação Final
- Console sem spam de duplicatas
- Realtime funcionando entre dispositivos
- Performance melhorada (menos queries redundantes)

---

## 📝 Checklist de Validação

- [x] Migration aplicada com constraints
- [x] Lock implementado no WorkflowSupabaseService
- [x] useIntegration corrigido (sem modificação de ID)
- [x] Rastreamento de orçamentos processados
- [x] Sync única movida para useWorkflowCacheInit
- [x] Logs estruturados adicionados
- [ ] Testes executados (aguardando validação do usuário)
- [ ] Dados limpos e re-populados (se necessário)
- [ ] Monitoramento sem alertas de duplicatas

---

## 🎉 Resultado Esperado

✅ **ZERO** appointments duplicados  
✅ **ZERO** sessões duplicadas  
✅ Realtime funcionando perfeitamente entre dispositivos  
✅ Banco com integridade garantida por constraints  
✅ Código limpo e centralizado  
✅ Performance melhorada (menos overhead)

