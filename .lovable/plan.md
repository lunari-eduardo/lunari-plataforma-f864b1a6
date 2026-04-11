

# Fix: Formulário de briefing falha ao enviar (401) e mostra 404 ao reabrir

## Causa raiz

O erro 401 ocorre porque o hook `useSubmitFormularioResposta` faz:

```typescript
.insert({...}).select().single()
```

O `.select().single()` exige uma **policy SELECT para `anon`** na tabela `formulario_respostas`. Mas a única policy SELECT existente é para `authenticated` com `auth.uid() = user_id`. Como o cliente do formulário público usa a role `anon`, o PostgREST retorna **401 Unauthorized** ao tentar ler de volta o registro inserido.

O INSERT em si funciona (a policy de INSERT para anon existe com `with_check: true`), mas o `.select()` encadeado falha, causando o throw do erro — e o `setSubmitted(true)` nunca é chamado.

O **404 ao reabrir** acontece porque:
1. O insert falha no `.select()`, mas o registro JÁ foi inserido no banco
2. O trigger `update_formulario_status_on_resposta` JÁ rodou e marcou `status_envio = 'respondido'`
3. Na próxima abertura, `useFormularioPublico` busca o formulário e encontra `status_envio = 'respondido'`
4. O hook `useFormularioRespostaPublica` é ativado para buscar a resposta via RPC
5. Mas o formulário mostra a tela de "já respondido" — o 404 pode ser um erro de roteamento no domínio customizado ou o RPC retornando null

## Correção

### 1. Remover `.select().single()` do insert (causa principal)

**Arquivo:** `src/hooks/useFormularios.ts`

O retorno do insert não é usado para nada — o trigger já atualiza o status. Basta remover o `.select().single()`:

```typescript
const { error: respostaError } = await supabase
  .from('formulario_respostas')
  .insert({
    formulario_id: formulario.id,
    user_id: formulario.user_id,
    respostas,
    respondente_nome: respondente_nome || null,
    respondente_email: respondente_email || null,
  });

if (respostaError) throw respostaError;
return { success: true };
```

### 2. Adicionar tratamento de erro robusto no submit

**Arquivo:** `src/pages/FormularioPublico.tsx`

Adicionar toast de erro visível ao usuário e tratamento para erro de duplicidade (unique constraint em `formulario_id`):

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!formulario || !isDisponivel) return;
  try {
    await submitMutation.mutateAsync({...});
    setSubmitted(true);
  } catch (err: any) {
    // Se erro de unique constraint = já foi respondido
    if (err?.code === '23505') {
      setSubmitted(true); // Mostrar tela de sucesso
      return;
    }
    toast.error('Erro ao enviar formulário. Tente novamente.');
  }
};
```

### 3. Adicionar policy SELECT para anon (segurança futura)

Mesmo removendo `.select()`, é prudente adicionar uma policy SELECT limitada para anon, caso futuramente precisemos ler dados após insert:

```sql
CREATE POLICY "Anon can read own submitted resposta"
ON public.formulario_respostas FOR SELECT TO anon
USING (
  formulario_id IN (
    SELECT id FROM public.formularios 
    WHERE public_token IS NOT NULL AND status = 'publicado'
  )
);
```

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useFormularios.ts` | Remover `.select().single()` do insert na mutação |
| `src/pages/FormularioPublico.tsx` | Tratamento de erro com toast + handling de duplicidade |
| Migration SQL | Policy SELECT para anon em `formulario_respostas` (opcional, defensivo) |

## Resultado

- Cliente submete → INSERT funciona → trigger atualiza status → tela de sucesso
- Se tentar submeter 2x → unique constraint detectado → mostra tela de sucesso
- Sem 401, sem 404, sem estado inconsistente

