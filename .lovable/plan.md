
# Plano: Corrigir Edição de Nome do Cliente no Modal de Agendamento

## Diagnóstico Detalhado

### Problema 1: Agendamento Pendente - "Cliente não vinculado"

**Causa raiz:** O agendamento pendente da "Maria Eduarda" foi criado com `cliente_id = NULL` no banco de dados, apesar de existir um cliente com esse nome no CRM.

| Campo | Valor no Banco |
|-------|----------------|
| title | Maria Eduarda |
| cliente_id | NULL |
| status | a confirmar |

O `ClientEditModal` verifica `clienteId` logo no início e exibe a mensagem de erro se estiver vazio:

```typescript
// ClientEditModal.tsx - linha 134
if (!clienteId) {
  return (
    // Modal "Cliente não vinculado"
  );
}
```

**Solução:** Buscar cliente por nome quando `clienteId` for vazio, permitindo vincular automaticamente.

---

### Problema 2: Cursor Move para o Final ao Digitar

**Causa raiz:** A função `handleNomeChange` aplica `toTitleCase()` a cada caractere digitado:

```typescript
// ClientEditModal.tsx - linha 69-71
const handleNomeChange = (value: string) => {
  setFormData(prev => ({ ...prev, nome: toTitleCase(value) }));
};
```

A função `toTitleCase()` transforma o texto inteiro, causando re-render que move o cursor para o final.

**Solução:** Aplicar `toTitleCase()` apenas no `onBlur`, não no `onChange`.

---

### Problema 3: Nome Não Atualiza no Modal Após Edição

**Causa raiz:** O `AppointmentDetails` exibe `formData.title` que é inicializado uma vez via `useState`:

```typescript
// AppointmentDetails.tsx - linha 40-49
const [formData, setFormData] = useState({
  title: appointment.title,  // Valor fixo no momento da renderização
  // ...
});
```

Quando o `ClientEditModal` atualiza o cliente no banco, o `formData.title` não é atualizado porque:
1. O modal não tem callback `onSuccess` que atualize o estado pai
2. O estado `formData` é local e não reage a mudanças externas

**Solução:** Adicionar callback `onSuccess` que atualiza `formData.title` com o novo nome do cliente.

---

## Alterações Necessárias

### 1. ClientEditModal.tsx

**1.1 - Buscar cliente por nome quando clienteId vazio:**

Modificar a lógica inicial para buscar o cliente pelo nome se `clienteId` estiver vazio.

**1.2 - Corrigir comportamento do cursor:**

Aplicar `toTitleCase` apenas no `onBlur`, manter valor bruto no `onChange`.

```typescript
// Estado para nome bruto (sem transformação)
const [nomeRaw, setNomeRaw] = useState('');

// onChange: apenas atualiza o valor bruto
const handleNomeChange = (value: string) => {
  setNomeRaw(value);
  setFormData(prev => ({ ...prev, nome: value }));
};

// onBlur: aplica Title Case
const handleNomeBlur = () => {
  const formatted = toTitleCase(formData.nome);
  setNomeRaw(formatted);
  setFormData(prev => ({ ...prev, nome: formatted }));
};
```

---

### 2. AppointmentDetails.tsx

**2.1 - Adicionar callback onSuccess ao ClientEditModal:**

```typescript
<ClientEditModal
  open={showClientEditModal}
  onOpenChange={setShowClientEditModal}
  clienteId={appointment.clienteId || ''}
  clienteNome={appointment.client}
  onSuccess={(novoNome) => {
    // Atualizar formData.title com o novo nome
    setFormData(prev => ({ ...prev, title: novoNome }));
  }}
/>
```

**2.2 - Modificar interface do ClientEditModal:**

```typescript
interface ClientEditModalProps {
  // ... props existentes
  onSuccess?: (novoNome?: string) => void;  // Adicionar parâmetro novoNome
}
```

---

## Resumo das Modificações

| Arquivo | Modificação |
|---------|-------------|
| `src/components/agenda/ClientEditModal.tsx` | Buscar cliente por nome, corrigir cursor, retornar nome no callback |
| `src/components/agenda/AppointmentDetails.tsx` | Receber novo nome no onSuccess e atualizar formData.title |

---

## Fluxo Corrigido

```text
1. Usuário clica no nome do cliente (pendente ou confirmado)
2. ClientEditModal abre:
   - Se clienteId vazio: busca cliente por nome
   - Se não encontrar: oferece criar vínculo
3. Usuário edita nome:
   - onChange: mantém texto como digitado (preserva cursor)
   - onBlur: aplica Title Case
4. Usuário clica Salvar:
   - Atualiza cliente no banco
   - Chama onSuccess(novoNome)
5. AppointmentDetails recebe callback:
   - Atualiza formData.title = novoNome
   - UI reflete imediatamente o novo nome
```
