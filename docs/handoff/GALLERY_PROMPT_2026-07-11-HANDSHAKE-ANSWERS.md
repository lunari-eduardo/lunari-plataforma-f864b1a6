# Handoff Gallery — Respostas ao handshake (2026-07-11)

Este documento responde diretamente aos 4 pontos levantados pelo Gallery
antes de iniciar as mudanças (Etapas B/C do lado de vocês). Todas as
respostas foram validadas contra o código atual das funções
`sync_gallery_extras_to_session`, `on_galeria_deleted_reset_session`,
`archive_gallery` / `delete_gallery_complete`, `guard_qtd_fotos_extra_pre_selecao`,
`set_session_extras` e da edge `gallery-update-session-photos` no Gestão.

---

## 1. Status intermediários (`em_selecao`, `selecao_completa` de PIX manual)

**A trigger `sync_gallery_extras_to_session` NÃO propaga `status_galeria`
para `clientes_sessoes`.** Ela só toca em `qtd_fotos_extra`,
`valor_foto_extra`, `valor_total_foto_extra` (e, em fallback, `galeria_id`).

Consequência prática para o Gallery:

- **Continuem escrevendo `galerias.status`** (`rascunho` → `enviado` →
  `selecao_iniciada` → `em_selecao` → `selecao_completa`). Esse é o campo
  canônico. A trigger reage a qualquer transição relevante nele.
- **Não escrevam `clientes_sessoes.status_galeria` diretamente.** Quem
  atualiza esse campo hoje é a edge `gallery-update-session-photos`
  (linhas ~150–200 do index.ts) — e só quando vocês chamam com
  `selecaoFinalizada: true` (seta `status_galeria = 'selecao_completa'`)
  ou com `statusGaleria` explícito.
- **Se quiserem refletir estados intermediários no workflow** (ex.: "cliente
  começou a selecionar"), a edge aceita `selecaoFinalizada: false` + apenas
  `statusGaleria: 'em_selecao'`. Nesse modo:
  - a edge **não** altera `qtd_fotos_extra` (o gate `allowExtrasPropagation`
    bloqueia enquanto a galeria não estiver finalizada);
  - a edge **não** promove `clientes_sessoes.status` para "Seleção
    finalizada" (isso só acontece com `selecaoFinalizada: true`);
  - a edge só grava `status_galeria = 'em_selecao'` na sessão.

Resumo: **`galerias.status` é obrigatório e suficiente para todo o
comportamento financeiro/visual do workflow.** A chamada à edge para
espelhar `status_galeria` intermediário é **opcional** — só faz sentido
se vocês quiserem que o workflow do fotógrafo mostre o badge
"em seleção" antes da finalização.

---

## 2. RPC `archive_gallery` — mexe em `clientes_sessoes` antes do `DELETE FROM galerias`?

**Não.** Verificação direta no código:

```
archive_gallery(p_gallery_id) → delete_gallery_complete(p_gallery_id, 'manual')
```

`delete_gallery_complete` faz, nesta ordem:

1. `SELECT ... FOR UPDATE` na galeria e checagem de posse.
2. Coleta paths de `galeria_fotos` (para retornar `paths_to_purge`).
3. Insere linha em `galerias_sessao_historico` (histórico) e `audit_log`.
4. `DELETE` em `galeria_fotos`, `galeria_pastas`, `visitante_selecoes`,
   `galeria_visitantes`.
5. **`DELETE FROM public.galerias WHERE id = p_gallery_id`.**
6. Retorna JSON com `paths_to_purge`.

**Nenhum `UPDATE clientes_sessoes` é feito por essa RPC.** Toda a lógica
de "congelar quantidade vendida na sessão" acontece via trigger
`on_galeria_deleted_reset_session` (AFTER DELETE) — que roda dentro da
mesma transação, imediatamente após o DELETE, e é a fonte única de
verdade para o estado pós-exclusão.

→ Gallery pode chamar `archive_gallery(id)` (ou o DELETE direto) sem
receio de concorrência. Não removam nada do Gestão para "não competir";
não há competição.

---

## 3. Reabertura — a trigger reage a cada `UPDATE fotos_selecionadas` mesmo com `finalized_at` preenchido?

**Sim, com uma condição: `galerias.status` precisa refletir o estado
atual.** A trigger não olha para `finalized_at`. O gate real (linhas
123–134 da função) é:

```
v_selecao_atualizou :=
     (NEW.status = 'selecao_completa'
       OR (v_has_paid_extras AND NEW.status IN ('selecao_iniciada','em_selecao')))
 AND (status mudou OR fotos_selecionadas mudou OR fotos_incluidas mudou)
 AND fotos_selecionadas >= fotos_incluidas
```

Ou seja:

- Se vocês reabrirem a galeria e **mantiverem `status = 'selecao_completa'`
  ou `em_selecao`/`selecao_iniciada` com cobrança de extra já paga**, cada
  incremento de `fotos_selecionadas` dispara a propagação para a sessão
  automaticamente. Zero chamada extra à edge.
- Se vocês reabrirem trocando o status para `enviado`/`rascunho` (não
  recomendado) e ainda não existir cobrança paga, a trigger **fica
  silenciosa** até a nova finalização — nesse caso é preciso chamar a
  edge com `selecaoFinalizada: true` de novo.

**Recomendação:** ao reabrir, deixem `status = 'em_selecao'` (ou
mantenham `selecao_completa`). Nada de zerar `finalized_at`; ele é só
metadata para o Gestão saber "já teve pelo menos uma finalização". A
trigger cuida do resto sem chamada adicional.

---

## 4. Chamada dupla da edge + trigger — risco de duplicação?

**A idempotência é garantida no banco, não na edge.** Detalhes:

- A edge `gallery-update-session-photos` faz um `UPDATE
  clientes_sessoes` direto (não usa `set_session_extras`). O UPDATE é por
  chave (`id`, `session_id` ou `galeria_id`) e escreve apenas os campos
  fornecidos. Chamar duas vezes com o mesmo payload **não duplica linhas
  nem dispara efeitos financeiros**, mas **grava duas linhas em
  `audit_log`** (via `sync_gallery_extras`) porque cada UPDATE reentra na
  trigger `sync_gallery_extras_to_session` (via
  `recalculate_session_valor_total` / triggers laterais).
- A trigger em si é idempotente no dado: o UPDATE interno tem cláusula
  `AND (... IS DISTINCT FROM ...)`, então **não escreve** se o valor final
  já é o mesmo. Nesse caso, `rows_by_fk = 0` e `rows_by_slug = 0` no
  `audit_log`.

**Regra prática para o Gallery evitar chamadas dobradas:**

| Cenário                                                  | Chamar edge? |
| -------------------------------------------------------- | ------------ |
| Cliente adicionou/removeu foto (galeria já finalizada)   | **Não** — só `UPDATE galerias SET fotos_selecionadas = X`. A trigger propaga. |
| Cliente finalizou seleção pela 1ª vez                    | **Sim** — 1 chamada com `selecaoFinalizada: true`. |
| Reabertura + nova finalização                            | **Sim** — 1 chamada com `selecaoFinalizada: true` (para reavaliar `clientes_sessoes.status`). |
| PIX manual mudou `status` para `em_selecao` ou similar   | Opcional — só se quiserem o badge no workflow. |
| Exclusão de galeria                                      | **Não** — `DELETE FROM galerias` (ou `archive_gallery`) já dispara `on_galeria_deleted_reset_session`. |

Se por qualquer motivo vocês precisarem chamar a edge redundantemente
(retry de rede, por exemplo), **é seguro** — o único efeito colateral é
uma linha extra em `audit_log` com `rows_by_fk=0`, que serve inclusive
como sinal de "estava tudo em dia". Não há geração de crédito, cobrança
ou transação duplicada.

---

## Contrato consolidado (TL;DR)

1. **Fonte da verdade** de estado da galeria: `public.galerias` (status,
   fotos_selecionadas, fotos_incluidas, valor_foto_extra,
   total_fotos_extras_vendidas). Toquem essa tabela livremente.
2. **`public.clientes_sessoes`** é do Gestão. Só a edge
   `gallery-update-session-photos` pode escrever nela, e apenas nos
   cenários da tabela acima.
3. **Exclusão**: use `archive_gallery(uuid)` ou `DELETE FROM galerias`.
   Não toque em `clientes_sessoes` antes. O Gestão preserva histórico
   financeiro via trigger.
4. **Reabertura**: `UPDATE galerias SET status='em_selecao',
   fotos_selecionadas=…`. Trigger propaga. Uma nova finalização = uma
   nova chamada à edge com `selecaoFinalizada: true`.
5. **Auditoria compartilhada**:

   ```sql
   SELECT * FROM public.audit_log
    WHERE gallery_id = '<uuid>'
    ORDER BY created_at DESC LIMIT 20;

   SELECT * FROM public.v_workflow_extras_divergence
    WHERE user_id = '<uuid>';
   ```

Com isso podem seguir Etapas B e C sem risco de regressão no Gestão.
