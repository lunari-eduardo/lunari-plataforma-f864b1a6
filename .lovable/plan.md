

# Correção: Metas personalizadas não persistem

## Diagnóstico

Após análise do banco e do código:

1. **Tabela e tipos existem corretamente** — `metas_personalizadas` está no schema, com unique constraint `(user_id, ano, mes, categoria)` e RLS policy funcional.

2. **`as any` casts desnecessários** — A tabela `metas_personalizadas` e o campo `modo_metas` já existem nos tipos gerados do Supabase. Os casts `as any` em todo o hook estão **mascarando erros de resposta** do Supabase (se houver falha no upsert, o TypeScript não consegue inferir o tipo do erro).

3. **Sem log de erros no save** — `salvarTodasMetas` e `salvarMetaCategoria` não logam erros. Se o upsert falhar, o erro é engolido silenciosamente.

4. **`config.modo_metas` usa cast desnecessário** — `(config as any)?.modo_metas` quando o campo já está nos tipos. O `select()` pode não inferir `modo_metas` porque a query especifica colunas como string.

5. **`updated_at` não atualiza no upsert** — Sem trigger, `updated_at` fica com o valor do INSERT original, o que é confuso mas não impede o funcionamento.

## Plano

### 1. `useMetasPersonalizadas.ts` — Remover `as any` e adicionar logs

- Trocar `supabase.from('metas_personalizadas' as any)` por `supabase.from('metas_personalizadas')` em todas as ocorrências
- Remover todos os `as any` desnecessários nos payloads e respostas
- Trocar `(config as any)?.modo_metas` por acesso direto (campo está nos tipos)
- Adicionar `console.error` em todos os pontos de save quando `error` existir
- Na query de config, usar `.select('*')` para garantir que todos os campos são retornados corretamente tipados (ou selecionar `modo_metas` explicitamente)
- Após cada upsert, fazer `console.log` do resultado para debug

### 2. Migration SQL — Trigger para `updated_at`

Criar trigger simples para atualizar `updated_at` automaticamente:

```sql
CREATE OR REPLACE FUNCTION update_metas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_metas_updated_at
BEFORE UPDATE ON public.metas_personalizadas
FOR EACH ROW EXECUTE FUNCTION update_metas_updated_at();
```

### 3. `MetasConfigTab.tsx` — Feedback de erro visível

- No `handleSalvarMensal` e `handleSalvarCategorias`, logar o erro completo no console
- Garantir que toast de erro mostra a mensagem real do Supabase

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useMetasPersonalizadas.ts` | Remover `as any`, adicionar error logging |
| Migration SQL | Trigger `updated_at` |
| `src/components/financas/MetasConfigTab.tsx` | Melhorar feedback de erro |

