

# Correções: Formulário Público — 401 no envio, redirect e modal sem destaque

## Problemas identificados

### 1. ERRO 401 ao submeter formulário (CRÍTICO)
**Causa**: A tabela `formularios` tem política de UPDATE restrita a `authenticated` com `auth.uid() = user_id`. Quando o cliente (anônimo) submete o formulário, o hook `useSubmitFormularioResposta` faz:
1. INSERT em `formulario_respostas` → funciona (política `anon` com `WITH CHECK (true)`)
2. UPDATE em `formularios` para mudar `status_envio = 'respondido'` → **FALHA 401** porque o cliente não está autenticado

**Solução**: Criar uma política RLS que permita `anon` e `authenticated` fazerem UPDATE **apenas nos campos de status** de formulários publicados com token público. Alternativamente (mais seguro), usar uma database function `SECURITY DEFINER` que atualiza o status após inserção da resposta, via trigger.

**Abordagem escolhida**: Trigger `AFTER INSERT ON formulario_respostas` que automaticamente atualiza o status do formulário para "respondido". Assim o código frontend remove a chamada de UPDATE direta, eliminando o erro 401.

### 2. Redirect para Landing Page no primeiro acesso
**Causa**: O service worker (PWA) cacheia a SPA e, no primeiro acesso a `/formulario/:token`, serve o HTML cacheado da rota `/`. Na segunda carga, o SW já resolveu a rota corretamente.

**Solução**: Adicionar `/formulario/` ao `navigateFallbackDenylist` na config do PWA, ou garantir que o SW não intercepte rotas públicas. Alternativa mais simples: no `vite.config.ts`, configurar o `workbox` para excluir essas rotas do cache de navegação.

### 3. Modal "Briefing Criado" não destaca do modal pai
**Causa**: O `SendBriefingModal` usa `Dialog` dentro de outro `Dialog` (AppointmentDetails). Ambos compartilham o mesmo overlay, então o modal filho não se distingue visualmente.

**Solução**: Passar `overlayClassName="backdrop-blur-sm bg-black/40"` no `DialogContent` do `SendBriefingModal` para criar uma camada visual de desfoque sobre o modal pai.

---

## Etapas de implementação

### Etapa 1 — Migration: Trigger para atualizar status automaticamente
Criar trigger `AFTER INSERT ON formulario_respostas` com function `SECURITY DEFINER`:
```sql
CREATE OR REPLACE FUNCTION update_formulario_status_on_resposta()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE formularios 
  SET status_envio = 'respondido', respondido_em = NOW()
  WHERE id = NEW.formulario_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_formulario_on_resposta
AFTER INSERT ON formulario_respostas
FOR EACH ROW
EXECUTE FUNCTION update_formulario_status_on_resposta();
```

### Etapa 2 — Remover UPDATE do frontend
Em `useFormularios.ts` → `useSubmitFormularioResposta`, remover o bloco que faz `supabase.from('formularios').update(...)` após inserir a resposta — o trigger cuida disso automaticamente.

### Etapa 3 — Fix redirect PWA
No `vite.config.ts`, adicionar `navigateFallbackDenylist: [/^\/formulario\//,  /^\/checkout\//]` na config do workbox para que o SW não intercepte rotas públicas.

### Etapa 4 — Desfoque no modal filho
Em `SendBriefingModal.tsx`, adicionar `overlayClassName` ao `DialogContent` para criar backdrop blur quando aberto sobre outro modal.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Trigger `update_formulario_status_on_resposta` |
| `src/hooks/useFormularios.ts` | Remover UPDATE manual no `useSubmitFormularioResposta` |
| `vite.config.ts` | Excluir rotas públicas do SW |
| `src/components/formularios/SendBriefingModal.tsx` | Adicionar backdrop blur no overlay |

