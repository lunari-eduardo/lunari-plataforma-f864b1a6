
# Recuperação das rotas públicas no domínio Vercel

## Diagnóstico validado
- As rotas React existem e estão corretas em `src/App.tsx` (`/formulario/:token`, `/checkout/:cobrancaId`, `/auth`, `/app`).
- A validação externa mostra que no domínio real `app.lunarihub.com` as URLs profundas (`/app`, `/auth`, `/formulario/...`, `/checkout/...`) renderizam a Landing, enquanto no domínio Lovable o formulário abre corretamente.
- O ponto crítico é a combinação atual de Vercel + fallback legado:
  - não há configuração versionada de rewrite SPA para Vercel
  - `public/404.html` redireciona para `/?redirect=...`
  - `BuildMonitor` faz `history.replaceState` tarde demais, depois que o app já renderizou `/`
  - resultado: a URL vira `/formulario/...`, mas o conteúdo continua sendo a Landing
- Além disso, houve regressões de domínio:
  - `getPublicShareBaseUrl()` passou a usar `lunari-plataforma.lovable.app`
  - `ChargeModal` ainda cria checkout com `window.location.origin`
  - isso explica links públicos abrindo no domínio errado

## Objetivo
Restaurar `https://app.lunarihub.com` como domínio canônico de produção para todo link público e fazer com que qualquer deep link funcione direto no Vercel, sem cair na Landing.

## Plano de correção

### 1. Corrigir a infraestrutura de roteamento no Vercel
- Adicionar um `vercel.json` versionado no projeto com rewrites de SPA para as famílias de rota públicas e protegidas:
  - `/app/:path*`
  - `/auth`
  - `/reset-password`
  - `/formulario/:path*`
  - `/checkout/:path*`
  - `/conteudos/:path*`
  - `/ajuda/:path*`
  - `/escolher-plano/:path*`
  - `/minha-assinatura`
  - `/onboarding`
  - `/landing`
- Garantir que assets reais fiquem fora do rewrite (`/lovable-uploads`, favicon, robots, version, ícones etc.).
- Isso elimina a dependência do `404.html` para deep links no domínio customizado.

### 2. Remover o fallback legado que mascara erro de rota
- Remover do `BuildMonitor` a lógica de `?redirect=` + `replaceState`.
- Ajustar `public/404.html` para deixar de ser um “redirector” universal e voltar a ser uma página 404 real.
- Se precisarmos manter compatibilidade temporária com links antigos, tratar `redirect` antes do mount em `src/main.tsx`, nunca depois do app já renderizado.

### 3. Recentralizar o domínio canônico
- Usar `VITE_SITE_URL=https://app.lunarihub.com` como fonte única para links públicos.
- Refatorar `src/utils/domainUtils.ts` para separar:
  - domínio canônico de produção
  - origem atual apenas quando ela for realmente necessária
- Regra nova: formulário, checkout transparente e demais links compartilhados para cliente sempre saem com `app.lunarihub.com`.
- O domínio Lovable deixa de ser fallback para links de produção.

### 4. Corrigir todos os geradores de links públicos
- Revisar e ajustar:
  - `src/components/formularios/SendBriefingModal.tsx`
  - `src/components/formularios/ClienteFormulariosList.tsx`
  - `src/components/cobranca/ChargeModal.tsx`
- Auditar outros usos de `window.location.origin` e manter isso apenas onde o host atual é proposital, como callbacks de integração.
- Garantir que checkout transparente nunca mais saia com `lovable.app`.

### 5. Estabilizar PWA/cache sem interferir nas rotas públicas
- Revisar `src/main.tsx`, `src/hooks/usePWAUpdate.ts` e `vite.config.ts`.
- Nesta fase de recuperação, simplificar o comportamento:
  - não usar service worker como parte da solução de roteamento
  - evitar limpezas agressivas de cache como “correção” de rota
- Se o PWA não for essencial, a abordagem mais segura é desativar o SW e manter só o app web normal.

### 6. Revisão completa de todas as rotas públicas
Validar acesso direto e refresh no domínio `app.lunarihub.com` para:
- `/`
- `/auth`
- `/reset-password`
- `/formulario/:token`
- `/checkout/:id`
- `/conteudos`
- `/conteudos/:slug`
- `/app`
- `/app/*`
- `/onboarding`
- `/escolher-plano`
- `/minha-assinatura`

### 7. QA orientada ao negócio
- Criar um formulário pela agenda/CRM, copiar link e abrir em aba anônima.
- Gerar uma cobrança por checkout transparente, copiar link e abrir fora da sessão autenticada.
- Testar abertura direta, refresh, nova aba e envio por WhatsApp.
- Confirmar que nenhum link novo usa `lovable.app`.
- Revisar também links públicos correlatos do ecossistema, especialmente fluxos que conversam com Gallery.

## Arquivos principais envolvidos
- `vercel.json` (novo)
- `src/main.tsx`
- `src/components/shared/BuildMonitor.tsx`
- `public/404.html`
- `src/utils/domainUtils.ts`
- `src/components/formularios/SendBriefingModal.tsx`
- `src/components/formularios/ClienteFormulariosList.tsx`
- `src/components/cobranca/ChargeModal.tsx`
- `src/hooks/usePWAUpdate.ts`
- `vite.config.ts`

## Resumo técnico
Há 2 falhas diferentes acontecendo ao mesmo tempo:
1. o Vercel não está resolvendo deep links da SPA corretamente no domínio customizado;
2. parte da geração de links públicos foi desviada para `lovable.app` ou para a origem errada.
A correção robusta precisa atacar as duas frentes juntas, senão o sistema continua inconsistente.
