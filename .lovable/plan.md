## Diagnóstico

Encontrei três causas principais no fluxo de edição do cliente no CRM:

1. **Auto-save indevido durante digitação**
   - `InlineEditField`, `PhoneInputSmart` e `FamilyMiniCard` salvam automaticamente com debounce de 800ms enquanto o usuário digita.
   - Isso conflita com a UI, que mostra botão de check como ação explícita de salvar.
   - Resultado: cada pausa na digitação dispara update no Supabase e notificações.

2. **Notificações duplicadas em camadas diferentes**
   - O campo mostra `toast.success('Salvo')`.
   - O hook `useClientesRealtime.ts` também mostra `toast.success('Cliente atualizado com sucesso')` dentro de `atualizarCliente`.
   - `atualizarClienteCompleto` chama `atualizarCliente` e depois mostra outro `toast.success('Cliente atualizado com sucesso')`.
   - Ao selecionar origem ou salvar família, isso pode acumular 2 a 3 toasts ao mesmo tempo.

3. **Perda de dados ao salvar campos isolados**
   - `ContactoTab` chama `onUpdate(cliente.id, { telefone: valor })`, `{ email: valor }`, `{ endereco: valor }`, etc.
   - Mas `atualizarClienteCompleto` monta um objeto de update com todos os campos, preenchendo campos ausentes como `null`.
   - Exemplo: ao salvar telefone, `email`, `endereco`, `observacoes`, `origem` podem ir como `null`. Depois, ao editar email, o telefone pode ser sobrescrito/apagado.

## Plano de correção

### 1. Remover auto-save de campos editáveis

Ajustar os componentes de edição inline para só salvar quando o usuário clicar no check ou pressionar Enter:

- `src/components/cliente-detalhe/shared/InlineEditField.tsx`
- `src/components/cliente-detalhe/shared/PhoneInputSmart.tsx`
- `src/components/cliente-detalhe/shared/FamilyMiniCard.tsx`

Mudanças:
- Remover timers/debounce que chamam `onSave` dentro de `onChange`.
- `onChange` passará apenas a atualizar estado local.
- `Escape` continuará cancelando.
- `Enter` continuará salvando.
- O check será a confirmação principal.

### 2. Centralizar política de notificações

Seguir a memória do projeto: **sem toast de sucesso para CRUD comum**.

Mudanças:
- Remover success toasts redundantes em:
  - `InlineEditField`
  - `PhoneInputSmart`
  - `FamilyMiniCard`
  - `OrigemVisualSelect`
  - `ContactoTab` observações
  - `useClientesRealtime.ts` para update comum de cliente/família
- Manter apenas `toast.error(...)` quando houver falha real.
- Para sucesso, usar feedback visual discreto no próprio campo: o input fecha, o valor aparece atualizado, e o ícone/check pode retornar ao estado normal.

Exceções que podem continuar com sucesso se fizer sentido fora desse fluxo:
- Migração de clientes.
- Ações destrutivas/raras se já existirem em outras telas, mas não no perfil do cliente durante edição normal.

### 3. Corrigir update parcial para não apagar dados

Refatorar `atualizarClienteCompleto` em `src/hooks/useClientesRealtime.ts` para montar o payload apenas com campos realmente enviados.

Exemplo de lógica esperada:

```ts
const updateData: Partial<ClienteSupabase> = {};

if ('nome' in dadosBasicos) updateData.nome = dadosBasicos.nome;
if ('email' in dadosBasicos) updateData.email = dadosBasicos.email || null;
if ('telefone' in dadosBasicos) updateData.telefone = dadosBasicos.telefone || null;
if ('endereco' in dadosBasicos) updateData.endereco = dadosBasicos.endereco || null;
if ('observacoes' in dadosBasicos) updateData.observacoes = dadosBasicos.observacoes || null;
if ('origem' in dadosBasicos) updateData.origem = dadosBasicos.origem || null;
if ('dataNascimento' in dadosBasicos) updateData.data_nascimento = dadosBasicos.dataNascimento || null;
```

Assim, salvar `telefone` não mexe em `email`, `endereco`, `origem` ou qualquer outro campo.

### 4. Evitar updates vazios e chamadas duplicadas

Ainda em `useClientesRealtime.ts`:
- Só chamar `atualizarCliente(id, updateData)` se `updateData` tiver pelo menos uma chave.
- Se o update for apenas de família, não disparar update vazio na tabela `clientes`.
- Garantir que família continue sincronizando somente quando `conjuge` ou `filhos` forem enviados.

### 5. Ajustar observações para o mesmo padrão

Hoje observações salva automaticamente após 800ms e ainda mostra `Salvo`.

Ajuste proposto:
- Trocar observações para edição explícita também, com botões de salvar/cancelar, ou reutilizar `InlineEditField` com `type="textarea"`.
- Isso deixa todo o perfil consistente: digitar não salva; check salva.

### 6. Ajustar origem para não gerar múltiplos toasts

Em `OrigemVisualSelect`:
- Selecionar uma origem salva uma vez.
- Remover toast local `Salvo`.
- Manter erro apenas se falhar.
- Fechar o seletor após sucesso.

### 7. Revisão de estado local após Realtime

Após remover auto-save e corrigir update parcial:
- Confirmar que os campos em edição não são resetados enquanto o usuário digita.
- Manter a regra atual de sincronização externa apenas quando não estiver editando.
- Isso evita que um update recebido via Realtime apague o valor em digitação.

## Resultado esperado

- Digitar endereço, telefone, email, nome ou família não dispara toast nem salva automaticamente.
- O usuário salva apenas ao clicar no check ou pressionar Enter.
- Selecionar origem não empilha notificações.
- Salvar um campo não apaga outro campo.
- Erros continuam aparecendo quando houver falha real.
- A experiência fica mais limpa, previsível e consistente com o padrão do projeto.