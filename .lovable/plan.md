
## Diagnóstico real

- Validei o comportamento fora do preview. O resultado foi decisivo:
  - `https://lunari-plataforma.lovable.app/formulario/fDf6sMQEoEdd` abre o formulário correto
  - `https://app.lunarihub.com/formulario/fDf6sMQEoEdd` abre a landing
  - `https://app.lunarihub.com/app` também abre a landing
  - `https://app.lunarihub.com/auth` também abre a landing
- Isso prova que o problema principal agora não é a rota React nem o PWA. O domínio `app.lunarihub.com` está servindo a experiência errada/stale para caminhos que deveriam abrir o app.
- O que agravou o cenário foi a regra atual de compartilhamento: `getPublicShareBaseUrl()` hoje prioriza `https://app.lunarihub.com` em host `lunarihub`. Como esse domínio está incorreto, os links passaram a sair quebrados.
- O blur do modal da agenda também não ficou resolvido de verdade: hoje o estado `sendBriefingOpen` só afeta o conteúdo interno de `AppointmentDetails`, mas o `DialogContent` pai continua visualmente forte.

## Plano de correção

### 1. Conter imediatamente o compartilhamento quebrado
- Parar de gerar links públicos com `app.lunarihub.com` até esse domínio ser revalidado.
- Fazer `getPublicShareBaseUrl()` usar uma base pública explícita e segura:
  - temporariamente `https://lunari-plataforma.lovable.app`
  - depois voltar para `app.lunarihub.com` só após smoke test do domínio
- Aplicar isso em:
  - `src/components/formularios/SendBriefingModal.tsx`
  - `src/components/formularios/ClienteFormulariosList.tsx`
- Revisar também links públicos correlatos, principalmente checkout em `src/components/cobranca/ChargeModal.tsx`, para não repetir o mesmo bug.

### 2. Corrigir a causa raiz no domínio/publicação
Essa parte não é só código; é domínio + publish.
- Validar em Publish/Domains se `app.lunarihub.com` está ligado a este projeto correto.
- Confirmar se não existe outro projeto/deploy de landing ocupando esse domínio.
- Publicar novamente a versão atual do frontend (“Update”), porque frontend só entra no domínio publicado após update.
- Se houver proxy/CDN externo, revisar para que `/app`, `/auth`, `/formulario/*` e `/checkout/*` apontem para esta app, não para a landing.
- Revalidar no domínio:
  - `/`
  - `/auth`
  - `/app`
  - `/formulario/:token`

### 3. Manter a blindagem das rotas públicas
Mesmo com o domínio sendo o problema central, a proteção do app deve continuar:
- manter bypass de SW/PWA em `/formulario/*` e `/checkout/*`
- manter `devOptions.enabled: false`
- manter `navigateFallbackDenylist`
- revisar `main.tsx` e `usePWAUpdate.ts` para garantir que preview/iframe/rotas públicas não registrem ou reaproveitem SW

### 4. Fechar corretamente o fluxo pós-resposta
Após o envio, o cliente não pode mais editar nem reenviar; o link passa a abrir só em visualização.
- `FormularioPublico.tsx` deve depender do estado persistente do banco, não apenas de `submitted` local
- reabertura do link:
  - `respondido` → visualização somente leitura
  - `expirado` → tela própria
  - inválido/indisponível → tela própria
- desabilitar completamente inputs, upload e botão de envio no modo finalizado
- manter a mesma resposta disponível para o fotógrafo no painel

### 5. Garantir resposta única sem risco
- Manter a trava de uma resposta por `formulario_id`
- Tratar duplicidade no frontend com mensagem amigável
- Revisar a migration recente `20260407183746...`, porque hoje ela apaga duplicados silenciosamente
  - se já foi aplicada, criar nova migration defensiva
  - se não foi aplicada, substituir por estratégia sem perda silenciosa de histórico

### 6. Corrigir de verdade o modal dentro do modal da agenda
- Subir o estado do briefing para `AgendaModals` ou expor esse estado ao modal pai
- Enquanto o briefing estiver aberto:
  - reduzir opacidade do `DialogContent` pai
  - aplicar blur/scale leves no modal pai inteiro
  - bloquear interação do pai
- manter o modal filho com overlay e z-index fortes
- objetivo: o pai inteiro entrar em estado de fundo, não só o conteúdo interno

## Arquivos/frentes envolvidas
- `src/utils/domainUtils.ts`
- `src/components/formularios/SendBriefingModal.tsx`
- `src/components/formularios/ClienteFormulariosList.tsx`
- `src/components/cobranca/ChargeModal.tsx`
- `src/main.tsx`
- `src/hooks/usePWAUpdate.ts`
- `vite.config.ts`
- `src/pages/FormularioPublico.tsx`
- `src/hooks/useFormularios.ts`
- `src/components/agenda/AppointmentDetails.tsx`
- `src/components/agenda/AgendaModals.tsx`
- migration SQL de ajuste seguro para resposta única/histórico

## Ordem recomendada
1. Contenção: voltar os links públicos para o domínio publicado que funciona
2. Corrigir `app.lunarihub.com` no domínio/publicação
3. Ajustar modal pai/filho da agenda
4. Fechar modo somente leitura + bloqueio amigável de segunda resposta
5. QA completo e só então reativar `app.lunarihub.com` nos links públicos

## QA obrigatória
- Copiar link novo de briefing e abrir em aba anônima
- Validar `/auth`, `/app` e `/formulario/:token` no custom domain
- Responder uma vez, recarregar e confirmar modo somente leitura
- Tentar reenviar e validar bloqueio amigável
- Abrir briefing pela agenda e confirmar destaque visual claro do modal filho sobre o pai
