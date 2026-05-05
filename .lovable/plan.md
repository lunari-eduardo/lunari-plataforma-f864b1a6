# Bug: Status revertendo para "Seleção finalizada"

## Causa Raiz Identificada

A edge function `supabase/functions/gallery-update-session-photos/index.ts` (chamada pelo projeto Gallery) contém uma lógica que **sobrescreve incondicionalmente** o `status` da sessão para `"Seleção finalizada"` sempre que recebe `selecaoFinalizada: true` no payload.

Trecho problemático (linhas 113–133):

```ts
if (body.selecaoFinalizada === true && sessionUserId) {
  const { data: systemStatus } = await supabase
    .from('etapas_trabalho')
    .select('nome')
    .eq('user_id', sessionUserId)
    .eq('nome', 'Seleção finalizada')
    .eq('is_system_status', true)
    .maybeSingle();

  if (systemStatus) {
    updateData.status = 'Seleção finalizada';        // ⚠️ sobrescreve sem checar status atual
    updateData.status_galeria = 'selecao_completa';
  }
}
```

### Cenário que reproduz o bug (Amanda Agne, Luize Baumart, Emily Zuge)

1. Cliente finaliza seleção no Gallery → status passa para **"Seleção finalizada"**.
2. Fotógrafo move manualmente o status no Gestão para **"Editando"**, **"Enviado Impressão"** ou **"Finalizado"**.
3. Qualquer evento posterior do Gallery que reenvie a função com `selecaoFinalizada: true` (re-cálculo de fotos extras, reabertura, retry de webhook, ação acidental do cliente, sync de pagamento que dispara o flag) → o Gestão **regrava `status = 'Seleção finalizada'`**, descartando o avanço do workflow.

Confirma o padrão: a maioria das sessões impactadas mostradas no banco têm `status_galeria = 'selecao_completa'` e foram movidas adiante manualmente — exatamente as candidatas a serem revertidas.

Não há trigger no Postgres que altere `status` (verificado em `pg_trigger` de `clientes_sessoes`). O ponto único de falha é essa edge function.

## Correção (Edge Function)

Aplicar **regra de não-regressão** em `gallery-update-session-photos`:

1. Buscar o `status` atual da sessão (já temos `findQuery` retornando a sessão — incluir `status` no select).
2. Definir uma lista ordenada do workflow pós-seleção que **não pode ser sobrescrita**:
   - `Editando`
   - `Enviado Impressão`
   - `Enviado para impressão`
   - `Finalizado`
   - Qualquer status custom do usuário cujo `ordem`/posição em `etapas_trabalho` seja **maior** que a etapa "Seleção finalizada" (consulta a `etapas_trabalho` para ser robusto a status customizados).
3. Se o status atual já for um desses, **não** sobrescrever para `"Seleção finalizada"`. Ainda atualizar `status_galeria = 'selecao_completa'` (campo informativo do Gallery), mas preservar o `status` do workflow.
4. Adicionar log explícito: `"⚠️ Status atual '<X>' é posterior a Seleção finalizada — preservando workflow"`.

Pseudo-código do trecho corrigido:

```ts
if (body.selecaoFinalizada === true && sessionUserId && sessionData) {
  // Buscar etapas do usuário com ordem
  const { data: etapas } = await supabase
    .from('etapas_trabalho')
    .select('nome, ordem, is_system_status')
    .eq('user_id', sessionUserId)
    .order('ordem', { ascending: true });

  const etapaSelecaoFinalizada = etapas?.find(e => e.nome === 'Seleção finalizada');
  const ordemSelecao = etapaSelecaoFinalizada?.ordem ?? null;
  const statusAtual = sessionData.status;
  const etapaAtual = etapas?.find(e => e.nome === statusAtual);

  const statusAtualEhPosterior =
    etapaAtual && ordemSelecao !== null && etapaAtual.ordem > ordemSelecao;

  // Lista hardcoded de fallback para nomes conhecidos
  const STATUS_POSTERIORES = ['Editando', 'Enviado Impressão', 'Enviado para impressão', 'Finalizado', 'Entregue'];

  const naoRegredir = statusAtualEhPosterior || STATUS_POSTERIORES.includes(statusAtual);

  if (etapaSelecaoFinalizada && !naoRegredir) {
    updateData.status = 'Seleção finalizada';
  } else if (naoRegredir) {
    console.log(`⚠️ Preservando status atual '${statusAtual}' (posterior a Seleção finalizada)`);
  }

  updateData.status_galeria = 'selecao_completa';
}
```

## Hardening complementar

### 1. Auditoria (nova tabela)
Criar `clientes_sessoes_status_audit` para registrar toda mudança de `status` (origem, valor antigo, valor novo, timestamp, contexto). Trigger AFTER UPDATE OF status grava o histórico. Permite investigar qualquer regressão futura e dar visibilidade ao usuário.

### 2. Trigger guard no banco (defesa em profundidade)
Criar função `prevent_session_status_regression()` em BEFORE UPDATE OF status:
- Lê `etapas_trabalho` do user, identifica `ordem` do status antigo e novo.
- Se o novo status tiver `ordem` menor que o atual **e** a transição não for explicitamente permitida (ex.: usuário movendo manualmente — exigir um GUC/`current_setting('app.allow_status_regression')` setado pela UI quando intencional), bloqueia ou apenas loga em `RAISE WARNING`.
- Implementação inicial conservadora: apenas **bloquear** regressões para `'Seleção finalizada'` quando o atual estiver na lista pós-seleção. Ações manuais do fotógrafo continuam livres (mais permissivo) — escolha mais segura.

Recomendação: começar só com **bloqueio específico** (`'Seleção finalizada'` não pode sobrescrever `Editando|Enviado Impressão|Finalizado|Entregue`), sem GUC, para evitar quebra de UX.

### 3. Memory de projeto
Registrar regra em `mem://features/workflow/gallery-status-sync` (já existe) acrescentando:
- "Gallery NUNCA pode regredir `status` que já passou de 'Seleção finalizada'. Edge function `gallery-update-session-photos` deve checar status atual antes de sobrescrever."

## Arquivos afetados

- `supabase/functions/gallery-update-session-photos/index.ts` — adicionar guarda de não-regressão + log.
- Migração: criar `clientes_sessoes_status_audit` + trigger de auditoria + trigger `prevent_session_status_regression` (escopo restrito).
- `mem://features/workflow/gallery-status-sync` — atualizar regra.

## Não inclui

- Não alteramos a UI do Gestão — fotógrafo continua podendo mover manualmente para qualquer status.
- Não corrigimos sessões já revertidas (usuário informou que já corrigiu manualmente).
- Não tocamos em outras edge functions; o ponto único confirmado é `gallery-update-session-photos`.

## Resultado esperado

Após aprovação:
- Gallery pode reenviar `selecaoFinalizada: true` quantas vezes quiser sem regredir o workflow.
- `status_galeria` continua refletindo o estado real da galeria.
- Auditoria permite diagnosticar qualquer outra origem de mudança de status no futuro.
- Trigger de banco impede regressão indevida mesmo se outra função/cliente tentar.
