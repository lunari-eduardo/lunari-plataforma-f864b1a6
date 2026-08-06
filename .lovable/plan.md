# Google Calendar — Auditoria completa e plano de correção

## O que a auditoria encontrou (verificado agora, não suposição)

1. **Nenhuma conexão jamais foi gravada.** Consulta em `usuarios_integracoes` com `provedor = 'google_calendar'`: **0 linhas**, para qualquer usuário.
2. **A função de callback nunca foi executada por um usuário real.** Os logs de `google-calendar-callback` contêm apenas as duas chamadas de teste que acabei de disparar. Nenhuma execução vinda do Google, em nenhum momento.
3. **A rota de callback está viva e funcionando.** `GET https://app.lunarihub.com/auth/google/callback?error=test` retorna 302 para `.../app/integracoes?tab=calendar&google_error=test`. O rewrite do Vercel e o deploy da Edge Function estão corretos.
4. **A função de início do fluxo funciona.** `google-calendar-connect` logou "Generated auth URL for user: db0ca3d8…" várias vezes hoje. Ou seja: o sistema gera a URL, o navegador vai para o Google — e **o Google nunca devolve o usuário para nós**.
5. Secrets `GOOGLE_CALENDAR_CLIENT_ID` e `GOOGLE_CALENDAR_CLIENT_SECRET` existem. RLS de `usuarios_integracoes` está correta (`auth.uid() = user_id`). Colunas `access_token`, `refresh_token`, `expira_em`, `status`, `dados_extras` existem e são nuláveis.

### Conclusão do diagnóstico

O ponto exato da falha **não está no nosso código de persistência** — ele nunca é alcançado. A falha ocorre entre "usuário clica em Conectar" e "Google redireciona de volta". Com 100% dos fluxos morrendo nesse trecho e zero callbacks registrados, a causa esmagadoramente provável é **configuração do cliente OAuth no Google Cloud Console**: o `redirect_uri` que enviamos (`https://app.lunarihub.com/auth/google/callback`) não está cadastrado como *Authorized redirect URI*, ou o app está em modo Testing sem o seu e-mail na lista de test users, ou os escopos sensíveis de Calendar não estão declarados na tela de consentimento.

Isso é verificável em 2 minutos com a checklist manual abaixo. Só depois disso faz sentido mexer em código — por isso a Onda 0 é obrigatória e vem primeiro.

Independente disso, a auditoria encontrou **defeitos reais no código** que causariam problemas assim que o Google voltar a redirecionar. Eles estão nas Ondas 1–3 e serão corrigidos de qualquer forma.

---

## O que você precisa conferir manualmente (Onda 0 — bloqueante)

No Google Cloud Console, no projeto que possui o Client ID usado pelo Lunari:

**A. Credentials → OAuth 2.0 Client ID (tipo Web application)**
- Em **Authorized redirect URIs**, deve existir exatamente, sem barra final:
  `https://app.lunarihub.com/auth/google/callback`
- Em **Authorized JavaScript origins**: `https://app.lunarihub.com`
- Confirme que o **Client ID exibido ali é o mesmo** que está no secret `GOOGLE_CALENDAR_CLIENT_ID` (compare os primeiros 12 caracteres).

**B. OAuth consent screen**
- **Publishing status**: se estiver "Testing", o seu e-mail precisa estar em **Test users**. Sem isso, o Google bloqueia antes do redirect.
- **Scopes**: precisam estar declarados `.../auth/calendar` e `.../auth/calendar.events` (são escopos sensíveis).
- **Authorized domains**: `lunarihub.com`.

**C. Teste manual decisivo (30 segundos)**
1. Clique em "Conectar Google Calendar" no Lunari.
2. Na tela do Google que aparecer, **tire um print da mensagem de erro** (ou copie o texto). As três respostas possíveis identificam a causa de forma definitiva:
   - `Erro 400: redirect_uri_mismatch` → item A errado.
   - `Erro 403: access_denied` / "O Lunari não concluiu o processo de verificação" → item B (Testing sem test user).
   - Tela de consentimento normal com "App não verificado" e link "Avançado" → configuração OK; clique em Avançado → Prosseguir, e a conexão deve gravar (aí a falha é nossa e as ondas 1–3 resolvem).

Me envie qual das três apareceu. Isso fecha o diagnóstico com certeza.

---

## Ondas de correção no código

### Onda 1 — Corrigir a gravação da integração (bug real confirmado)

Arquivo: `supabase/functions/google-calendar-callback/index.ts`

- O `select` do registro existente busca **apenas `id`**, mas o código depois lê `existing?.refresh_token` — que é sempre `undefined`. Resultado: numa reconexão em que o Google não devolve `refresh_token` (comum quando o usuário já autorizou antes), o token de refresh existente é **apagado** e o status cai para `pendente` para sempre. Correção: `select('id, refresh_token')`.
- O objeto `integrationPayload` tem a chave **`refresh_token` duplicada** (linhas 112 e 114). Remover a duplicata.
- Não há tratamento de erro do `Response.redirect` quando `stateData.redirectUri` vem malformado. Passar a validar que a URL é `https://app.lunarihub.com/...` antes de redirecionar; caso contrário usar o padrão.
- Adicionar logs explícitos de entrada (`code presente`, `state decodificado`, `userId`) para que qualquer falha futura apareça nos logs em vez de silenciar.

### Onda 2 — Reconexão sem perder o refresh token

Arquivo: `supabase/functions/google-calendar-connect/index.ts`

- Hoje enviamos sempre `prompt=consent`, o que força nova tela toda vez. Isso é correto para garantir refresh token, mas combinado com o bug da Onda 1 causava perda de estado. Manter `prompt=consent` + `access_type=offline` (garante refresh token) e passar `include_granted_scopes=true`.
- Validar no início se `GOOGLE_CALENDAR_CLIENT_ID` termina com `.apps.googleusercontent.com` e retornar erro claro se não, evitando o fluxo morrer no Google sem explicação.

### Onda 3 — Feedback honesto na interface

Arquivos: `src/hooks/useGoogleCalendarIntegration.ts`, `src/components/integracoes/GoogleCalendarCard.tsx`, `src/components/preferencias/IntegracoesTab.tsx`

- Hoje, se o usuário volta do Google sem sucesso, a tela simplesmente reaparece como "Conectar" sem explicar nada — foi exatamente a sua experiência. Passar a exibir o motivo do erro vindo de `google_error` em um estado persistente no card (não só um toast que some).
- Tratar o estado `pendente` (integração salva sem refresh token) com um aviso "Conexão incompleta — reconecte" e botão de reconectar, em vez de mostrar como conectado.
- Após o retorno com `google_success`, refazer o fetch com um pequeno retry (2 tentativas) para cobrir latência de replicação, em vez de um único fetch.

### Onda 4 — Validação fim a fim

- Conectar pela interface e confirmar nos logs de `google-calendar-callback` a linha "Integration saved for user: …".
- Confirmar em `usuarios_integracoes` uma linha com `status = 'ativo'` e `refresh_token` preenchido.
- Desconectar e reconectar uma segunda vez, confirmando que `refresh_token` continua preenchido (é o cenário que a Onda 1 conserta).
- Criar um agendamento confirmado e verificar `google_event_id` preenchido em `appointments`.

---

## Notas técnicas

- Nada do fluxo de **Login com Google via Supabase Auth** é tocado em nenhuma onda; a integração de Calendar usa um cliente OAuth próprio e a tabela `usuarios_integracoes`.
- O rewrite do Vercel (`/auth/google/callback` → Edge Function) e a rota SPA de fallback já estão corretos e verificados; não serão alterados.
- Se a Onda 0 revelar `redirect_uri_mismatch`, nenhuma alteração de código resolve — é cadastro no Google Cloud Console. As Ondas 1–3 continuam valendo por serem defeitos reais.
