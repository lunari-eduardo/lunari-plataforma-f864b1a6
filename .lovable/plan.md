## Objetivo

Impedir a criação de galerias duplicadas para a mesma sessão, permitindo no máximo 1 Galeria de Seleção e 1 Galeria de Entrega por sessão. Bloquear no frontend (UX) e no banco (integridade).

## Frontend — `WorkflowCardCollapsed.tsx`

No componente `GalleryButtons` (linhas 262-321):

1. Calcular tipos já existentes a partir de `galerias`:
   - `temSelecao = galerias.some(g => g.tipo === 'selecao')`
   - `temEntrega = galerias.some(g => g.tipo === 'entrega')`
   - `temTodas = temSelecao && temEntrega`

2. Botão **Criar**:
   - Esconder completamente quando `temTodas === true`.
   - No popover, esconder a opção "Galeria de Seleção" se `temSelecao`, e "Galeria de Entrega" se `temEntrega`.
   - Se sobrar apenas 1 opção, ainda assim manter o popover (consistência visual) — ou opcionalmente clicar direto. Manter popover é mais simples.

3. Botão **Ver**: continua aparecendo quando `hasGalerias` (sem mudança).

4. Resultado visual:
   - Sem galerias → só "Criar" (2 opções).
   - Só Seleção → "Criar" (1 opção: Entrega) + "Ver".
   - Só Entrega → "Criar" (1 opção: Seleção) + "Ver".
   - Ambas → só "Ver".

5. Defesa adicional nos handlers `handleCreateSelecao` / `handleCreateEntrega`: re-checar `galerias` antes de prosseguir e exibir `toast.error` se já existir aquele tipo (evita corrida com clique duplo / cache desatualizado).

Nenhum outro componente do CRM/Workflow chama criação de galeria — confirmado via `rg`.

## Backend — Migração Supabase

Criar índice único parcial em `public.galerias` para garantir 1 galeria por (sessão, tipo) entre galerias ativas:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uniq_galerias_session_tipo
  ON public.galerias (session_id, tipo)
  WHERE session_id IS NOT NULL;
```

Observações:
- Hoje não há duplicatas (`SELECT ... HAVING COUNT(*) > 1` retornou vazio), então o índice será criado sem conflito.
- `session_id IS NOT NULL` permite galerias avulsas (sem sessão) sem restrição.
- O índice cobre tanto inserts diretos via cliente quanto qualquer edge function (gallery-create-payment etc.).

Tratamento do erro no frontend: no `createGaleria` de `useGalerias.ts`, mapear erro Postgres `23505` (unique_violation) com mensagem `"Já existe uma galeria deste tipo para esta sessão"`.

## Verificação

- Criar 1 Seleção → botão "Criar" passa a oferecer só "Entrega"; "Ver" aparece.
- Criar 1 Entrega → botão "Criar" some; só "Ver" permanece com 2 itens.
- Tentativa de insert duplicado via SQL ou edge function → erro 23505 do Postgres.

## Arquivos afetados

- `src/components/workflow/WorkflowCardCollapsed.tsx` (lógica do `GalleryButtons` + handlers).
- `src/hooks/useGalerias.ts` (tratamento do erro 23505).
- Nova migração SQL com o índice único parcial.
