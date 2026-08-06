# Google Calendar — Auditoria do callback e correção

## O que foi verificado agora (com evidência)

1. **A rota `/auth/google/callback` NÃO é servida pela SPA.** Chamada real a
   `https://app.lunarihub.com/auth/google/callback?code=TEST&state=abc` respondeu **302** com
   headers `x-served-by: supabase-edge-runtime` e `sb-project-ref: tlnjspsywycbudhewsfv`.
   O rewrite do `vercel.json` funciona e a Edge Function executa.
2. **O `code` e o `state` chegam.** Log da função no mesmo instante:
   `Incoming callback: code=true, state=true, error=null`.
3. **A troca de código por tokens existe** (`POST https://oauth2.googleapis.com/token`) e a
   gravação em `usuarios_integracoes` existe (update se já houver registro, insert caso contrário).
4. **Nenhuma integração Google jamais foi gravada.** Consulta em `usuarios_integracoes`
   com `provedor ilike '%google%'` retorna **zero linhas**.
5. **A tabela e o RLS estão corretos.** Política `auth.uid() = user_id` para `authenticated`;
   a gravação é feita com service role (ignora RLS). RLS não é a causa.
6. **Bug real confirmado: o erro nunca chega à interface.** Três retornos de erro montam a URL com
   `?` fixo. Como o `redirectUri` já contém `?tab=calendar`, sai
   `.../app/integracoes?tab=calendar?google_error=missing_params` — parâmetro inválido, ignorado
   pelo navegador. Além disso, **o frontend não lê `google_error` nem `google_success` em lugar nenhum**.
   Resultado: qualquer falha volta para a tela de integrações exatamente como estava, sem aviso.
   Foi isso que você observou.
7. **Os logs da Edge Function têm retenção curta** — as suas tentativas de hoje já não existem.
   Por isso ainda não é possível afirmar *qual* etapa falha (token exchange, criação de calendário
   ou gravação). Diagnóstico: não confirmado. A primeira onda resolve isso de forma permanente.

## Plano

### Onda 1 — Tornar a falha visível e rastreável (obrigatória)

- Criar tabela `google_oauth_debug` (service role grava, usuário lê os próprios registros):
  `user_id`, `etapa`, `sucesso`, `detalhe` (jsonb sem tokens), `created_at`.
- No `google-calendar-callback`, gravar uma linha em cada etapa:
  callback recebido → state decodificado → resposta do token endpoint (status, `error`,
  `has_access_token`, `has_refresh_token`, `scope`) → criação do calendário → resultado do
  insert/update (com mensagem e código do erro Postgres) → redirect final.
  Nenhum token bruto é gravado.
- Corrigir a montagem das URLs de retorno: usar sempre um helper que verifica se já existe `?`
  (hoje quebrado em `missing_params`, `token_exchange_failed`, `database_error`).
- Deixar de engolir a exceção: o `catch` final passa a gravar a mensagem real e a devolver
  `google_error=unknown&detail=<mensagem curta>`.

### Onda 2 — Feedback honesto na interface

- `useGoogleCalendarIntegration` passa a ler `google_success` / `google_error` da URL ao montar:
  sucesso → refetch e confirmação; erro → toast com o motivo traduzido
  (token recusado, banco, permissão negada, parâmetros ausentes) e limpeza dos parâmetros da URL.
- O card mostra estado `pendente` (conectado sem `refresh_token`) com botão "Reconectar" em vez de
  aparentar desconectado.

### Onda 3 — Correção definitiva

Após uma tentativa real com os logs persistidos, a etapa exata que falha fica identificada em
`google_oauth_debug` e a correção é aplicada nela (por exemplo: `redirect_uri` divergente no token
exchange, escopo insuficiente para criar calendário, ou conflito de chave na gravação). Sem essa
evidência qualquer correção seria chute.

## O que você precisa conferir manualmente

1. **Google Cloud Console → Credenciais → Client OAuth (Web)**
   - *URIs de redirecionamento autorizados* deve conter **exatamente**
     `https://app.lunarihub.com/auth/google/callback` (sem barra final, sem `www`).
   - *Origens JavaScript autorizadas*: `https://app.lunarihub.com`.
2. **Tela de consentimento** — escopos `.../auth/calendar` e `.../auth/calendar.events`;
   app em produção ou seu e-mail listado como usuário de teste.
3. **Supabase → Edge Functions → Secrets** — `GOOGLE_CALENDAR_CLIENT_ID` (terminando em
   `.apps.googleusercontent.com`) e `GOOGLE_CALENDAR_CLIENT_SECRET` do **mesmo** client.
   Um secret de outro client é a causa clássica de `invalid_client` silencioso.
4. **Faça o teste sempre a partir de `https://app.lunarihub.com`**, nunca do preview do Lovable —
   o rewrite do callback só existe no domínio de produção.

## Detalhes técnicos

- Arquivos alterados: `supabase/functions/google-calendar-callback/index.ts`,
  `src/hooks/useGoogleCalendarIntegration.ts`, `src/components/integracoes/GoogleCalendarCard.tsx`.
- Migração: nova tabela `google_oauth_debug` com GRANTs e RLS (leitura própria, escrita service role).
- As Edge Functions precisam ser publicadas para as mudanças valerem em produção.
