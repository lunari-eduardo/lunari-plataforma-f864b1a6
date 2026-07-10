# Handoff Gallery — Sincronizar seleção finalizada (2026-07-10)

## Sintoma observado no Gestão

Sessão do workflow (fotógrafo) fica com `qtd_fotos_extra = 0` mesmo depois
que o cliente confirma a seleção na galeria. Só é atualizada quando algum
pagamento é registrado. Isso quebra a exibição de "extras pendentes"
até que a venda aconteça, e em fluxos de pagamento manual causou
crédito duplicado (já corrigido no Gestão em 2026-07-10).

## Caso concreto

- Galeria: `be2cf467-b49d-4a49-a9ce-ff21b63d3507`
- Status: `selecao_completa` (finalizada em 2026-07-09 21:02 BRT)
- `fotos_incluidas = 10`, `fotos_selecionadas = 14` → qtd extras esperada = 4
- Antes do pagamento manual: `total_fotos_extras_vendidas = 0`
- Edge function `gallery-update-session-photos` do Gestão **não foi
  chamada** durante a finalização (sem logs para essa galeria nem para o
  slug `workflow-1779287842184-r01jr2f9s6`).

## O que investigar no Gallery

1. **Fluxo de finalização de seleção** (procure por `finalizeSelection`,
   `confirmSelection`, ou a edge/action que marca a galeria como
   `selecao_completa`).
2. Nesse ponto, o Gallery **precisa** notificar o Gestão via edge:

   ```
   POST https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/gallery-update-session-photos
   Content-Type: application/json
   apikey: <anon key do Gestão / mesma que Gallery já usa nas outras chamadas>

   {
     "galeriaId": "<uuid da galeria>",
     "sessionId": "<slug workflow-... da galeria.session_id>",
     "qtdFotosExtra": <fotos_selecionadas - fotos_incluidas>,
     "selecaoFinalizada": true,
     "statusGaleria": "selecao_completa"
   }
   ```

   A edge do Gestão já respeita:
   - `extras_overridden = true` na sessão (não sobrescreve ajuste manual);
   - `guard_qtd_fotos_extra_pre_selecao` (não permite propagação
     prematura).

3. **Idempotência**: chamar só UMA vez por finalização. Sugestão: usar
   `galerias.finalized_at IS NULL` como guarda antes do POST, e só então
   setar `finalized_at`.

4. **Erros**: logar retorno da edge. Se falhar, expor no painel do
   fotógrafo para permitir retry manual.

## Como validar

- Rodar o fluxo do cliente na galeria de teste;
- Após confirmação da seleção, checar no Gestão:
  ```sql
  SELECT qtd_fotos_extra, valor_total_foto_extra
    FROM public.clientes_sessoes
   WHERE galeria_id = '<uuid>';
  ```
  Deve refletir a diferença `fotos_selecionadas - fotos_incluidas`
  imediatamente (sem esperar pagamento).

## Observação sobre o Gestão

O Gestão também recebeu uma trigger de defesa em profundidade
(`sync_gallery_extras_to_session` reagindo à transição de status para
`selecao_completa`). Ou seja, mesmo que a chamada acima ainda não
esteja implementada no Gallery, a sincronização acontece no DB
compartilhado. A chamada explícita continua sendo a via correta —
serve para observabilidade (logs) e para casos onde o Gallery precise
enviar `qtd` diferente da simples subtração.
