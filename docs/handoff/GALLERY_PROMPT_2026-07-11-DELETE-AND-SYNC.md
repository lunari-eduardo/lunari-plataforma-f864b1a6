# Handoff Gallery — Sincronização Galeria↔Sessão (2026-07-11)

## Contexto

Gallery e Gestão compartilham o mesmo banco Supabase. O Workflow do Gestão exibe extras de uma sessão a partir de duas fontes:

1. `public.clientes_sessoes.qtd_fotos_extra` (snapshot da sessão)
2. `public.galerias.fotos_selecionadas − fotos_incluidas` (fonte viva)

Uma RPC (`public.workflow_session_financials`) combina as duas. Quando as duas divergem, o usuário vê "flash" 1→2 na abertura do card, e ao excluir a galeria os extras "regridem" para o valor antigo.

## O que foi corrigido no Gestão hoje

- Trigger `sync_gallery_extras_to_session` agora acha a sessão mesmo quando `clientes_sessoes.galeria_id` está NULL (fallback por `session_id`/slug + auto-tie).
- Trigger `guard_qtd_fotos_extra_pre_selecao` deixou de reverter aumentos legítimos originados pela própria sync (marcador `lunari.trusted_sync`).
- Novo trigger `AFTER DELETE ON public.galerias` (`on_galeria_deleted_reset_session`) reprocessa a sessão vinculada preservando a quantidade já vendida.
- Toda ação passa a gravar linha em `public.audit_log` (`sync_gallery_extras`, `guard_qtd_reverted`, `on_galeria_deleted_reset`).
- View `public.v_workflow_extras_divergence` lista sessões cujo `qtd_fotos_extra` diverge do que a RPC calcula.
- Frontend do Workflow esconde o número de extras enquanto a RPC carrega, quando há galeria vinculada.

## O que precisa acontecer no Gallery

### 1. Finalização de seleção (já solicitado no handoff anterior, revalidando)

Ao marcar galeria como `selecao_completa`, chame:

```
POST https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/gallery-update-session-photos
Content-Type: application/json
apikey: <mesma anon key já usada nas outras chamadas>

{
  "galeriaId": "<uuid>",
  "sessionId": "<slug workflow-... / agenda-... da galeria.session_id>",
  "qtdFotosExtra": <fotos_selecionadas − fotos_incluidas>,
  "selecaoFinalizada": true,
  "statusGaleria": "selecao_completa"
}
```

- Chamar **UMA vez por finalização** (idempotência: guardar com base em `finalized_at IS NULL`).
- Em reabertura + nova seleção + nova finalização, chamar de novo com a nova quantidade.

### 2. Reabertura de galeria

Quando o cliente reabre a galeria e seleciona mais fotos, o Gallery deve:

- Atualizar `public.galerias.fotos_selecionadas` com o novo total.
- **Não** mexer em `public.galerias.total_fotos_extras_vendidas` — esse campo é gerenciado pelas cobranças (só sobe quando venda ocorre).
- Não precisa mexer em `public.clientes_sessoes` — a trigger `sync_gallery_extras_to_session` do Gestão vai propagar automaticamente quando o status voltar a `selecao_completa`, ou imediatamente se já existir cobrança paga de extras vinculada à galeria.

### 3. Exclusão de galeria

Se o Gallery permitir excluir galerias, apenas execute o `DELETE FROM public.galerias WHERE id = $1`. A trigger `on_galeria_deleted_reset_session` cuida do resto:

- Preserva `qtd_fotos_extra` da sessão igual ao total já vendido (`OLD.total_fotos_extras_vendidas`).
- Recalcula `valor_foto_extra` a partir das cobranças pagas históricas.
- Grava `audit_log` com o antes/depois.

**Não** faça `UPDATE public.clientes_sessoes SET qtd_fotos_extra = 0` manualmente na hora da exclusão — isso apaga histórico financeiro.

### 4. Contratos de dados (tabelas que o Gallery pode tocar)

| Tabela                               | Escrita permitida pelo Gallery                                | Observação                                                                                            |
| ------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `public.galerias`                    | `fotos_selecionadas`, `fotos_incluidas`, `status`, `status_pagamento`, `configuracoes`, `total_fotos_extras_vendidas` (só via cobrança confirmada) | `regras_congeladas` é **imutável** após `dataCongelamento` — guard `guard_regras_congeladas_immutable` bloqueia. |
| `public.galeria_fotos`               | tudo (upload/seleção)                                         | Não afeta o Workflow diretamente.                                                                     |
| `public.visitante_selecoes`          | tudo                                                          | —                                                                                                     |
| `public.cobrancas`                   | inserir/atualizar cobranças com `galeria_id`                  | Sempre setar `finalidade` = `fotos_extras` ou `sessao_e_extras`. NUNCA `sessao` para venda de galeria. |
| `public.clientes_sessoes`            | **NÃO ESCREVER**                                              | Fonte gerida pelo Gestão + triggers.                                                                  |
| `public.clientes_transacoes`         | **NÃO ESCREVER**                                              | Fonte gerida pelo Gestão via webhooks/edge.                                                           |
| `public.cliente_creditos_ledger`     | **NÃO ESCREVER**                                              | Gerido por triggers do Gestão.                                                                        |

### 5. Diagnóstico compartilhado

Se algo divergir no Workflow após uma ação do Gallery, olhem juntos:

```sql
SELECT * FROM public.audit_log
 WHERE action IN ('sync_gallery_extras','guard_qtd_reverted','on_galeria_deleted_reset')
   AND gallery_id = '<uuid>'
 ORDER BY created_at DESC LIMIT 20;

SELECT * FROM public.v_workflow_extras_divergence
 WHERE user_id = '<uuid>';
```

Isso mostra exatamente qual trigger correu, quantas linhas afetou, e se a guarda de pré-seleção reverteu algum aumento.

## Resumo em uma frase

> Gallery é dono de `galerias`, `galeria_fotos`, `visitante_selecoes` e das cobranças que ele cria. Toca `clientes_sessoes` **apenas** via a edge `gallery-update-session-photos` (na finalização). Tudo mais é do Gestão.
