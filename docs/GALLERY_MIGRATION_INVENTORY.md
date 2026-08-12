# Gallery Migration Inventory

> Documento de inventário técnico do projeto **lunari-gallery**, produzido para subsidiar o planejamento futuro de migração do módulo Gallery para dentro do **lunari-studio**.
>
> Escopo desta análise: **somente o repositório `lunari-gallery`**. Nenhuma comparação com o Studio foi feita aqui. Nenhum código foi alterado.
>
> Convenção: itens que não puderam ser confirmados com segurança lendo o código estão marcados como **"Não confirmado"**.

---

## 1. Estrutura geral do projeto

- Projeto Vite + React 18 + TypeScript, standalone (`package.json`: `lunari-gallery`, `private: true`).
- Roteamento: `react-router-dom` v6, `BrowserRouter` único em `src/App.tsx`.
- Data-fetching/cache: `@tanstack/react-query` v5.
- UI: Radix UI + Tailwind (shadcn-style, `components/ui/*`), `lucide-react`, `recharts`, `embla-carousel`, `react-hook-form` + `zod`.
- Backend: Supabase (`@supabase/supabase-js`), client próprio (não compartilhado em código com o Studio, mas aponta para o **mesmo projeto Supabase**, mesma URL e mesma anon key — ver seção 16).
- Pagamentos: Asaas, MercadoPago, InfinitePay (edge functions próprias).
- Storage de arquivos: Cloudflare R2 (via edge functions `r2-upload`, `gestao-r2-*` etc. hospedadas no projeto Supabase compartilhado — ver seção 13/14).
- Sem módulo/kernel de capabilities (padrão simples: hooks + `supabase-js` direto nas páginas/hooks).

Estrutura de pastas (nível relevante):

```
src/
├─ App.tsx, main.tsx, index.css
├─ assets/            (logos, imagens demo)
├─ components/        (componentes de UI e de domínio — ~60 arquivos + subpastas)
│  ├─ ui/             shadcn/radix
│  ├─ gallery/        grids editoriais, pricing model editor
│  ├─ dashboard/      (pasta "themes/" só, ver nota)
│  ├─ credits/        checkout/pacotes de créditos
│  ├─ deliver/        componentes da galeria de entrega
│  ├─ settings/       configurações do fotógrafo
│  ├─ account/, admin/, auth/, client/, legal/, preferences/
├─ contexts/          AuthContext, ThemeContext, VisualThemeContext
├─ data/mockData.ts
├─ hooks/             ~25 hooks (galerias, créditos, storage, pagamentos, etc.)
├─ integrations/supabase/  client.ts, types.ts
├─ lib/               utilitários (pricing, storage, upload, watermark, etc.)
├─ pages/             26 páginas (ver seção 2)
├─ types/             gallery.ts, themes.ts
└─ utils/paymentSettingsContext.ts
```

Nota: `src/components/dashboard/` contém apenas uma subpasta `themes/`; não há um "DashboardXxx.tsx" dedicado — o dashboard é implementado diretamente nas páginas `Home.tsx` e `Dashboard.tsx` (ver seção 4/5).

---

## 2. Rotas e páginas existentes

Fonte: `src/App.tsx` (roteador único, sem layouts aninhados por seção — o `Layout` é aplicado manualmente por rota).

| Rota | Página | Proteção | Observação |
|---|---|---|---|
| `/` | `Index.tsx` | pública | Redireciona para `/dashboard` (com sessão) ou `/auth` (sem sessão). Comentário no código identifica esta rota como raiz do domínio `gallery.lunarihub.com`. |
| `/auth` | `Auth.tsx` | pública | Login/cadastro |
| `/access-denied` | `AccessDenied.tsx` | pública | — |
| `/privacidade` | `Privacidade.tsx` | pública | — |
| `/termos` | `Termos.tsx` | pública | — |
| `/g/:token` | `ClientGallery.tsx` | pública (token) | Rota **nova** de acesso do cliente final via token público |
| `/client/:id` | `ClientGallery.tsx` | pública (legado) | Rota legada, mesma página, redireciona internamente para o novo formato (Não confirmado o mecanismo exato de redirecionamento interno — não lido em detalhe) |
| `/gallery/:id/preview` | `GalleryPreview.tsx` | protegida | Preview do fotógrafo simulando visão do cliente, sem `Layout` |
| `/dashboard` | `Home.tsx` (dentro de `Layout`) | protegida | Dashboard principal (ver seção 4) |
| `/galleries` | `Dashboard.tsx` (dentro de `Layout`) | protegida | Listagem de galerias de seleção |
| `/galleries/select` | `Dashboard.tsx` | protegida | Mesma página, aba "seleção" |
| `/galleries/deliver` | `Dashboard.tsx` | protegida | Mesma página, aba "entrega" |
| `/deliver/:id` | `DeliverDetail.tsx` | protegida | Detalhe de galeria de entrega |
| `/clients` | `Clients.tsx` | protegida | Listagem de clientes da Gallery |
| `/clients/:clientId` | `ClientProfile.tsx` | protegida | Perfil de cliente da Gallery |
| `/gallery/new` | `GalleryCreate.tsx` | protegida | Criação de galeria de seleção |
| `/deliver/new` | `DeliverCreate.tsx` | protegida | Criação de galeria de entrega |
| `/gallery/:id` | `GalleryDetail.tsx` | protegida | Detalhe/gestão de galeria de seleção |
| `/gallery/:id/edit` | `GalleryEdit.tsx` | protegida | Edição de galeria de seleção |
| `/settings` | `Settings.tsx` | protegida | Configurações gerais do fotógrafo/conta Gallery |
| `/account` | `Account.tsx` | protegida | Conta do usuário (Gallery) |
| `/credits` | `Credits.tsx` | protegida | Planos e créditos |
| `/credits/subscription` | `SubscriptionManagement.tsx` | protegida | Gestão de assinatura de armazenamento (Transfer) |
| `/credits/checkout` | `CreditsCheckout.tsx` | protegida | Checkout de compra de créditos (sem `Layout`) |
| `/credits/checkout/pay` | `CreditsPayment.tsx` | protegida | Tela de pagamento (sem `Layout`) |
| `/admin` | `Admin.tsx` | protegida | Painel admin interno da Gallery |
| `/referrals` | `Referrals.tsx` | protegida | Indique e Ganhe |
| `*` | `NotFound.tsx` | pública | catch-all |

Páginas existentes não roteadas diretamente no `App.tsx` listado, mas presentes na pasta `pages/`: `ClientDeliverGallery.tsx` (Não confirmado onde é usada — provavelmente rota de cliente final para entrega, requer checagem adicional, possivelmente referenciada dentro de `ClientGallery`/`DeliverDetail` ou rota adicional não capturada nesta leitura).

---

## 3. App Shell e navegação

Arquivo principal: `src/components/Layout.tsx`.

- Header fixo (`sticky top-0`) com:
  - Logo (`Logo.tsx`) linkando para `/`.
  - Navegação desktop: Dashboard, Galerias (`/galleries/select`, match por prefixo `/galleries`), Clientes, popover "Nova Galeria" (com dois links: `/gallery/new` "Seleção" e `/deliver/new` "Transfer"), Configurações.
  - Menu do usuário (dropdown): Minha Conta (`/account`), Planos e Créditos (`/credits`), Indique e Ganhe (`/referrals`), Aparência (modal `AppearanceModal`), Sair.
  - `ThemeToggle` (dark/light).
- Navegação mobile: menu hambúrguer com os mesmos itens, popover vira lista expandida inline.
- `InternalBackground` component aplicado como fundo decorativo em todas páginas exceto `/dashboard`.
- Layout **não é usado** nas rotas de checkout (`/credits/checkout*`) nem no preview (`/gallery/:id/preview`) — essas têm chrome próprio ou nenhum.
- Não há sidebar lateral — a navegação é 100% via header horizontal (diferente do padrão de Sidebar do Studio).

---

## 4. Dashboard

Dois dashboards distintos coexistem:

### 4.1 `/dashboard` → `Home.tsx`
Painel de visão geral da conta:
- Cards de recursos da conta: créditos disponíveis (`usePhotoCredits`) e armazenamento (`useTransferStorage`), com CTAs para `/credits` e `/credits/subscription`.
- Métricas mensais: galerias criadas, enviadas, seleções concluídas, vendas extras do mês (calculadas em memória a partir de `useSupabaseGalleries`, filtrando `tipo === 'selecao'`).
- Gráfico de pizza (`recharts`) com distribuição de status das galerias de seleção.
- Tabela "Aguardando ação": galerias com status `expirado` ou `selecao_completa`.
- Lista "Galerias ativas": status `enviado` ou `selecao_iniciada`, ordenadas por prazo.
- Feed de atividades recentes: query direta a `galeria_acoes` (join implícito com `galerias` via select aninhado) — `supabase.from('galeria_acoes').select(... galerias(nome_sessao, cliente_nome))`.

### 4.2 `/galleries` → `Dashboard.tsx`
Página de **listagem/gestão de galerias** (funciona como um dashboard operacional, não só listagem simples) — ver seção 5.

---

## 5. Listagem, criação e edição de galerias

### 5.1 Listagem — `src/pages/Dashboard.tsx` (702 linhas)
- Usa `useSupabaseGalleries()` como fonte de dados (`galerias` table completa, sem paginação server-side — carrega tudo e filtra em memória).
- Abas por status (`Tabs`): Todas, Criadas, Enviadas, Em seleção, Concluídas (`selectStatusFilters`).
- Busca por texto, popovers de ação (reenviar, arquivar/excluir com `DeleteGalleryDialog`, reabrir seleção com `ReactivateGalleryDialog`/`ReactivateSuccessModal`).
- Cards de galeria: `GalleryCard.tsx` (seleção) e `DeliverGalleryCard.tsx` (entrega) — a mesma página cobre as duas abas de rota (`/galleries/select`, `/galleries/deliver`) alternando o conjunto de cards renderizado.
- Componente `TransferStorageIndicator` embutido mostra uso de armazenamento (Transfer plan) no topo, com alerta de excedente e dias até exclusão automática.
- Modal de envio: `SendGalleryModal.tsx`.
- Indicadores de status calculados via `getEffectiveGalleryStatus` (`lib/galleryStatus.ts`).

### 5.2 Criação — `src/pages/GalleryCreate.tsx` (2534 linhas — maior arquivo do projeto)
Fluxo com múltiplas seções controladas por estado local (stepper implícito, não roteado):
- Seleção/criação de cliente (`ClientSelect`, `ClientModal`).
- Upload de fotos (`PhotoUploader`, com fila de upload — `QueueState`).
- Gestão de pastas (`FolderManager`).
- Configuração de venda: modo (`SaleMode`), modelo de preço (`PricingModel`), pacotes de desconto, watermark, prazo, permissões (pública/privada + senha), tema visual, fonte, espaçamento de fotos.
- **Modo assistido ("Gestão")**: hook `useGestaoParams()` lê query params (`session_id`, `cliente_id`, `cliente_nome`, `cliente_email`, `cliente_telefone`, `pacote_categoria`, `pacote_nome`, `fotos_incluidas_no_pacote`, `preco_da_foto_extra`, `modelo_de_cobranca`, `modelo_de_preco`) — ver seção 15 para detalhamento completo deste fluxo.
- Função local `getInitialExtraPrice` resolve preço de foto extra a partir de `RegrasCongeladas` (regras de precificação "congeladas" no momento da criação, vindas do Gestão/Studio).
- Persistência via `useSupabaseGalleries().createGallery` (insert direto na tabela `galerias`).
- Créditos: consulta `usePhotoCredits` para validar/consumir crédito de criação (Não confirmado o ponto exato de débito de crédito — não lido a fundo neste arquivo de 2534 linhas; a leitura foi parcial, limitada às primeiras ~80 linhas e ao entry point).

### 5.3 Detalhe/Gestão — `src/pages/GalleryDetail.tsx` (1450 linhas)
- Visão completa de uma galeria de seleção: header com ações (enviar, copiar link, arquivar, reabrir seleção, editar), grid de fotos, resumo de seleção, histórico de ações (`ActionTimeline`), estado de pagamento (`PaymentStatusCard`, `PaymentHistoryCard`).
- Usa `useIsMobile` para variantes de layout (Sheet no mobile).

### 5.4 Edição — `src/pages/GalleryEdit.tsx` (1448 linhas)
- Reaproveita praticamente os mesmos componentes de `GalleryCreate` (ClientSelect, ClientModal, PhotoUploader, FolderManager, PackageSelect, FontSelect, PricingModelEditor) para editar uma galeria existente.
- Inclui fluxos de exclusão (`DeleteGalleryDialog`) e reativação (`ReactivateGalleryDialog`/`ReactivateSuccessModal`) diretamente na tela de edição.
- Usa `useGestaoPackages`, `useSettings`, `useGalleryClients`.

### 5.5 Hook central — `src/hooks/useSupabaseGalleries.ts` (510 linhas)
Fonte única de acesso a dados de galerias no frontend:
- `transformGaleria(row)` / `transformPhoto(row)`: mapeiam linhas snake_case da tabela `galerias`/`galeria_fotos` para modelos camelCase (`Galeria`, `GaleriaPhoto`).
- Query `galleries`: `select('*') from galerias order by created_at desc` (client-side filtering, sem paginação DB).
- `fetchGalleryPhotos(galleryId)`: busca `galeria_fotos` e aplica ordenação natural (`lib/photoOrdering.ts`).
- Mutations: `createGallery` (insert em `galerias`, gera `public_token` local via `generatePublicToken()`), `updateGallery`, `deleteGallery` (invoca edge function `archive-gallery`), `publishGallery`/`sendGallery` (RPC `prepare_gallery_share`), `reopenSelection` (RPC `reopen_gallery_selection`), `deletePhoto`/`deletePhotos` (delete direto em `galeria_fotos`).
- Campo `tipo: 'selecao' | 'entrega'` na própria tabela `galerias` diferencia os dois tipos de galeria (seleção vs. entrega/transfer) — **não são tabelas separadas**.
- Campos de venda "novos" (`venda_modo`, `venda_pagamento_provedor`, `venda_tipo_cobranca`) são colunas dedicadas, com fallback para o JSON `configuracoes.saleSettings` (comentário no código confirma migração em andamento de JSON→colunas).

---

## 6. Seleção de fotos

- Página de cliente final: `src/pages/ClientGallery.tsx` (rotas `/g/:token` e `/client/:id`) — não lida em profundidade (fora do escopo de leitura detalhada solicitado, mas identificada como entry point).
- Componentes relevantes identificados em `src/components/`:
  - `PhotoCard.tsx` — card individual de foto com seleção/favorito.
  - `Lightbox.tsx` — visualização ampliada.
  - `MasonryGrid.tsx`, `RowMasonryGrid.tsx`, `JustifiedRowsGrid.tsx`, `EditorialGrid.tsx`, `EditorialTemplatesGrid.tsx` — múltiplos layouts de grid para exibição de fotos (temas editoriais).
  - `SelectionSummary.tsx` — resumo da seleção atual (contagem, extras, valor).
  - `SelectionConfirmation.tsx` — tela/etapa de confirmação final da seleção.
  - `DiscountProgressBar.tsx` — barra de progresso de desconto progressivo conforme quantidade de fotos extras.
  - `VisitorIdentificationScreen.tsx` — tela de identificação do visitante (nome/email) antes de acessar a galeria.
  - `PasswordScreen.tsx` — tela de senha para galerias privadas.
  - `UnifiedAccessScreen.tsx` — provável tela unificada de gate de acesso (senha/identificação).
  - `ContactCollectionModal.tsx` — coleta de contato do cliente.
- Edge Functions relacionadas (ver seção 14): `client-selection`, `confirm-selection`, `gallery-access`, `gallery-visitors`.
- Não confirmado: fluxo detalhado passo-a-passo de seleção (identificação → grid → seleção → confirmação → pagamento de extras) não foi rastreado linha a linha; inferido pela existência dos componentes acima.

---

## 7. Entrega de fotos

- Páginas do fotógrafo: `DeliverCreate.tsx` (criação), `DeliverDetail.tsx` (gestão).
- Página do cliente final: `ClientDeliverGallery.tsx` (rota exata não confirmada no roteador lido — não localizada explicitamente em `App.tsx`; **Não confirmado**).
- Componentes em `src/components/deliver/`:
  - `DeliverHero.tsx`, `DeliverHeader.tsx` — cabeçalho/hero da galeria de entrega.
  - `DeliverPhotoGrid.tsx`, `DeliverPhotoManager.tsx` — grid e gestão de fotos entregues.
  - `DeliverLightbox.tsx` — visualização ampliada.
  - `DeliverFloatingBar.tsx` — barra flutuante de ações (provavelmente download).
  - `DeliverWelcomeModal.tsx` — modal de boas-vindas ao cliente.
  - `CoverCatalog.tsx` + subpasta `covers/` — catálogo de capas para a galeria de entrega.
  - Subpasta `memory/` — Não confirmado o propósito exato (não lida).
- Mesma tabela `galerias` com `tipo = 'entrega'` (não há tabela separada — ver seção 5.5).
- Download: `lib/downloadUtils.ts`, `lib/deliverDownloadUtils.ts` — utilitários de download de fotos (provavelmente ZIP via `jszip`, dependência presente no `package.json`).

---

## 8. Configurações

Página: `src/pages/Settings.tsx`. Componentes em `src/components/settings/`:

- `GeneralSettings.tsx` — configurações gerais (permissão padrão, tema do cliente, dias de expiração padrão, nome do estúdio).
- `PersonalizationSettings.tsx` — personalização visual (tema, favicon, logo).
- `ThemeConfig.tsx`, `LogoUploader.tsx`, `FaviconUploader.tsx` — branding.
- `WatermarkSettings.tsx`, `WatermarkDefaults.tsx`, `WatermarkUploader.tsx` — configuração de marca d'água padrão.
- `CoverConfig.tsx` — configuração de capa padrão de galerias de entrega.
- `EmailTemplates.tsx`, `EmailTemplateModal.tsx`, `EmailAutomationSettings.tsx` — templates de e-mail e automações de envio (galeria enviada, reativada, pagamento confirmado).
- `PaymentSettings.tsx`, `PaymentConfigDrawer.tsx` — configuração de provedor de pagamento (Asaas/MercadoPago/InfinitePay) por fotógrafo.

Hook central: `src/hooks/useSettings.ts` (Não lido em detalhe — inferido pelo uso extensivo em `GalleryCreate`, `GalleryEdit`, `Dashboard`). Tabela provável: `gallery_settings` (ver seção 13; **Não confirmado nome exato da tabela** por falta de leitura direta do hook).

Configurações globais são tipadas em `types/gallery.ts` como `GlobalSettings` (defaults de venda, watermark, tema, cover, etc.) — ver estrutura completa nesse arquivo.

---

## 9. Sistema de créditos

Hook: `src/hooks/usePhotoCredits.ts`.
- Fonte de dados: tabela `photographer_accounts`, colunas `photo_credits` (créditos comprados/avulsos) e `credits_subscription` (créditos de assinatura).
- `photoCredits` total = `photo_credits + credits_subscription`.
- Admins (`accessLevel === 'admin'`) têm acesso ilimitado (tratado na UI, ex. `Credits.tsx` mostra ícone de infinito).
- Página `Credits.tsx`: exibe saldo, compra de pacotes (`useCreditPackages`), duas colunas — "Gallery Select" (créditos de seleção) e armazenamento "Transfer" (`useTransferStorage`).
- Componentes: `components/credits/CreditPackageCard.tsx`, `CreditPackagesModal.tsx`, `CreditCheckoutModal.tsx`, `CardPaymentForm.tsx`, `PixPaymentDisplay.tsx`.
- Checkout dedicado fora do `Layout`: `CreditsCheckout.tsx` → `CreditsPayment.tsx`.
- Consumo de créditos: ocorre presumivelmente na criação de galeria (`GalleryCreate.tsx` consulta `usePhotoCredits`), mas o ponto exato de débito **não foi confirmado** nesta leitura (possivelmente via trigger de banco ou edge function — não localizado).

---

## 10. Planos/assinaturas relacionados à Gallery

- Hook `useAsaasSubscription.ts` — gestão de assinatura via Asaas (Não lido em detalhe; usado em `MinhaAssinatura`-equivalente e em `SubscriptionManagement.tsx`).
- Hook `useUnifiedPlans.ts` — usado em `Credits.tsx` para obter preços de planos combo (`combo_pro_select2k`, `combo_completo`), sugerindo um catálogo de planos unificado entre "Select" (créditos de galeria) e "Transfer" (armazenamento).
- Hook `useTransferStorage.ts` — assinatura de armazenamento (Transfer), lida de `subscriptions_asaas` (tabela), com status `ACTIVE`/`PENDING`/`OVERDUE`; calcula `storageUsedBytes`, limites por plano (`lib/transferPlans.ts`), e alerta de exclusão automática por excedente.
- Página `SubscriptionManagement.tsx` — gestão da assinatura de armazenamento (cancelar, upgrade/downgrade — inferido pelo nome, não lido em detalhe).
- Conceito de planos: "Gallery Select" (créditos pré-pagos) e "Gallery Transfer" (armazenamento por assinatura) são tratados como produtos distintos dentro do mesmo app, mas compartilham o conceito de "combo" (`combo_pro_select2k`, `combo_completo`).

---

## 11. Indique e Ganhe

Hook: `src/hooks/useReferrals.ts`. Página: `src/pages/Referrals.tsx`.

- Código de indicação: RPC `ensure_referral_code()` (cria/retorna código do usuário atual).
- Tabela `referrals` (cast `as any` no código — sugere tipos desatualizados/não gerados para essa tabela em `integrations/supabase/types.ts`).
- Campos observados via `ReferralItem`: `id`, `referred_user_id`, `referred_name`, `created_at`, `select_bonus_granted` (bônus de créditos de seleção), `transfer_bonus_active`/`transfer_bonus_bytes` (bônus de armazenamento).
- Métricas expostas: `totalReferrals`, `creditsEarned`, `storageBonusBytes`, `activeTransferReferrals`.
- Link de indicação gerado por `getReferralUrl()` (`lib/galleryUrl.ts`), que usa o domínio de produção `gallery.lunarihub.com` quando em produção, ou `window.location.origin` em dev — rota de destino: `/auth?ref=<codigo>`.
- UI: cards de estatísticas + botão de copiar link + histórico de indicados.

---

## 12. Integrações importantes

| Integração | Uso | Evidência |
|---|---|---|
| **Supabase** | Banco de dados, Auth, Storage (parcial), Edge Functions, Realtime | `integrations/supabase/client.ts`, uso onipresente |
| **Asaas** | Cobranças/assinaturas (galeria e Transfer) | Edge functions `asaas-*`, hook `useAsaasSubscription.ts` |
| **MercadoPago** | Pagamento alternativo de cobranças de galeria/créditos | Edge functions `mercadopago-*` |
| **InfinitePay** | Pagamento alternativo | Edge functions `infinitepay-*` |
| **Cloudflare R2** | Armazenamento de fotos originais/otimizadas | Edge functions `r2-upload`, `gestao-r2-*`, `lib/storage.ts`, `lib/photoUrl.ts` |
| **jszip** | Download em lote (ZIP) de fotos entregues | dependência em `package.json`, `lib/downloadUtils.ts` |
| **date-fns** | Formatação de datas (pt-BR) | uso extensivo |
| **recharts** | Gráficos do dashboard | `Home.tsx` |
| **@react-three/fiber` + `three`** | Não confirmado o uso exato — dependências presentes no `package.json` mas nenhum uso identificado nos arquivos lidos (possível efeito visual 3D em alguma tela não explorada) |

---

## 13. Tabelas do Supabase utilizadas

Levantamento por evidência direta de código (`supabase.from('...')` / `supabase.rpc('...')`) nos arquivos lidos. Lista **não exaustiva** — projeto tem >150 arquivos e nem todos foram abertos.

### Tabelas (`.from`)
- `galerias` — entidade central (seleção **e** entrega, via coluna `tipo`).
- `galeria_fotos` — fotos de cada galeria.
- `galeria_acoes` — timeline/histórico de ações da galeria (`ActionTimeline`, feed do dashboard).
- `photographer_accounts` — conta do fotógrafo: créditos (`photo_credits`, `credits_subscription`).
- `subscriptions_asaas` — assinaturas Asaas (usada para storage Transfer; provavelmente também para Select, **não confirmado** se é a mesma tabela para os dois produtos).
- `referrals` — indicações (tipado como `any`, indício de schema não sincronizado nos types gerados).

### RPCs identificadas
- `user_has_gallery_access` — **Não confirmado neste repositório**: não localizada chamada direta nos arquivos lidos do lunari-gallery (essa função foi vista anteriormente no contexto do Studio/módulo `gallery`; pode ser chamada por outro ponto não lido, ou pode ser exclusiva do lado Studio). Marcar como pendente de verificação.
- `ensure_referral_code` — gera/retorna código de indicação do usuário autenticado.
- `prepare_gallery_share` — publica/marca galeria como enviada e (provavelmente) gera/atualiza `public_token`.
- `reopen_gallery_selection` — reabre seleção por N dias.

### Tabelas referenciadas apenas por tipo/comentário (não vistas em query direta nos arquivos lidos, mas citadas em nomes de hook/config)
- `gallery_settings` (provável nome da tabela por trás de `useSettings`/`GlobalSettings` — **Não confirmado**, hook não lido em detalhe).
- `clientes` da Gallery (distinta do CRM do Studio) — usada por `useGalleryClients` (hook não lido em detalhe nesta rodada — **Não confirmado** nome exato da tabela).

> Recomenda-se, numa etapa futura, gerar a lista completa via grep sistemático de `.from(` e `.rpc(` em todo `src/` do lunari-gallery antes de iniciar a migração real, pois esta lista cobre apenas os arquivos efetivamente lidos nesta análise.

---

## 14. Edge Functions, APIs ou serviços externos relevantes

Lista completa de Edge Functions presentes em `supabase/functions/` do `lunari-gallery` (por nome de diretório — conteúdo não lido individualmente, exceto onde indicado):

**Pagamentos / Assinaturas**
- `asaas-cancel-subscription`, `asaas-create-customer`, `asaas-create-payment`, `asaas-create-subscription`, `asaas-downgrade-subscription`, `asaas-fetch-fees`, `asaas-gallery-payment`, `asaas-gallery-webhook`, `asaas-upgrade-subscription`, `asaas-webhook`
- `mercadopago-check-payment`, `mercadopago-create-link`, `mercadopago-credits-payment`, `mercadopago-oauth`, `mercadopago-public-key`, `mercadopago-refresh-token`, `mercadopago-webhook`
- `infinitepay-create-link`, `infinitepay-webhook`
- `check-payment-status`, `confirm-payment-manual`, `payment-auto-heal`
- `gallery-create-payment` — **nome idêntico** a uma edge function existente no lado Studio (`supabase/functions/gallery-create-payment` no lunari-studio) — indício forte de que ambos os projetos apontam para o **mesmo backend Supabase compartilhado** (mesma URL/projeto).

**Galeria / Seleção / Cliente final**
- `archive-gallery` — exclusão definitiva de galeria (apaga fotos do R2 + registro).
- `client-selection` — provavelmente processa ações de seleção do cliente final.
- `confirm-selection` — confirmação final da seleção pelo cliente.
- `delete-photos` — exclusão de fotos.
- `gallery-access` — controle de acesso à galeria (senha/token/visitante).
- `gallery-og` — Open Graph dinâmico para preview em redes sociais/WhatsApp (usado por `getGalleryOgUrl`).
- `gallery-visitors` — rastreamento de visitantes da galeria.

**Storage (R2)**
- `r2-upload` — upload genérico para R2.

**Outros**
- `record-auth-fingerprint` — fingerprint de dispositivo/auth (ver `lib/deviceFingerprint.ts`).
- `send-email` — envio de e-mails transacionais (templates de `EmailTemplates.tsx`).
- `functions/_shared/` — código compartilhado entre functions (não lido).

> Nota importante: as pastas `gestao-*` (ex.: `gestao-asaas-anticipation`, `gestao-r2-upload`, `gestao-r2-signed-url` etc.) e `gallery-update-session-photos`, `provision-gallery-workflow-statuses`, vistas anteriormente no **lunari-studio**, **não existem** na listagem de `supabase/functions/` do `lunari-gallery`. Isso é evidência adicional de que **as duas aplicações compartilham o mesmo projeto/instância Supabase** (mesmo banco, mesmo conjunto global de Edge Functions), mesmo tendo pastas locais de functions parcialmente diferentes em cada repositório (cada repo parece conter só as functions que "possui"/mantém, mas todas rodam no mesmo projeto remoto).

---

## 15. Fluxos especiais de criação de galerias (redirecionamento/JSON)

Mecanismo identificado: **query params na URL**, não um payload JSON serializado embutido diretamente (ao menos não neste ponto de entrada). Fonte: `src/hooks/useGestaoParams.ts` + `src/types/gallery.ts` (`GestaoSessionParams`).

Fluxo:
1. O sistema externo ("Gestão" — presumivelmente o Studio) redireciona o usuário para `/gallery/new` no domínio da Gallery, anexando query params:
   `session_id`, `cliente_id`, `cliente_nome`, `cliente_email`, `cliente_telefone`, `pacote_categoria`, `pacote_nome`, `fotos_incluidas_no_pacote`, `preco_da_foto_extra`, `modelo_de_cobranca` (`no_sale`|`sale_with_payment`|`sale_without_payment`), `modelo_de_preco` (`fixed`|`packages`).
2. `useGestaoParams()` lê esses parâmetros via `useSearchParams`, valida/sanitiza (ex.: `preco_da_foto_extra` tem teto de R$ 999,99; `fotos_incluidas_no_pacote` clamp 0–9999), e os persiste em um `useRef` para sobreviver à limpeza da URL.
3. `hasGestaoParams`/`isAssistedMode` = `true` quando há `session_id` — isso ativa o "modo assistido" em `GalleryCreate.tsx`, pré-preenchendo cliente, pacote e regras de preço.
4. `RegrasCongeladas` (tipo em `lib/pricingUtils.ts`) parece representar as regras de precificação "congeladas" no momento em que a sessão foi criada no sistema de origem — persistidas depois na galeria (`galerias.regras_congeladas`) para preservar o preço acordado mesmo que a tabela de preços mude depois.
5. Ao salvar, `createGallery` grava `session_id` na tabela `galerias`, permitindo vincular a galeria de volta à sessão de origem no outro sistema.
6. Existe também a edge function `gallery-update-session-photos` (vista no lado Studio, não no Gallery) que — pelo nome — permite à Gallery **atualizar de volta** campos de fotos extras/status na sessão de origem, fechando o ciclo bidirecional. **Não confirmado neste repositório** (função não está no `lunari-gallery`, é chamada presumivelmente via `fetch`/`supabase.functions.invoke` a partir daqui, mas a chamada específica não foi localizada nos arquivos lidos).

**Importante para a migração**: conforme diretriz do usuário, este fluxo de criação assistida via query params + `regras_congeladas` é o mecanismo de integração mais crítico e **deve ser uma das últimas coisas a serem migradas/descontinuadas**, já que outros sistemas (o "Gestão"/Studio atual) dependem dele para criar galerias por redirecionamento.

---

## 16. Dependências importantes entre frontend, banco e storage

- **Banco compartilhado**: `integrations/supabase/client.ts` do Gallery aponta para a mesma `SUPABASE_URL` (`https://tlnjspsywycbudhewsfv.supabase.co`) e mesma anon key vistas no lunari-studio — **confirma que os dois frontends operam sobre o mesmíssimo projeto Supabase** (banco, auth, storage e edge functions únicos). Isso é uma dependência estrutural crítica: qualquer alteração de schema afeta os dois apps simultaneamente.
- **Tabela `galerias` é o núcleo único** para seleção e entrega (campo `tipo`), com colunas denormalizadas para performance (`cover_storage_key`, `first_photo_storage_key`) atualizadas por trigger a partir de `galeria_fotos`.
- **Storage de fotos**: não fica no Supabase Storage nativo — fica no **Cloudflare R2**, acessado via Edge Functions (`r2-upload`) e helpers (`lib/photoUrl.ts`, `lib/storage.ts`). O client Supabase é usado só para metadados (linhas em `galeria_fotos`), não para os binários.
- **Auth compartilhado**: mesmo projeto Supabase implica mesma base de usuários (`auth.users`) entre Gallery e Studio — um usuário autenticado num app tem, em tese, sessão válida no outro se o token for propagado (**mecanismo de propagação entre domínios não confirmado** — cada app usa seu próprio `localStorage` para `persistSession`, o que **não** compartilha sessão automaticamente entre subdomínios diferentes sem configuração extra de cookie/domain).
- **Pagamentos**: cobranças de galeria/créditos passam por Edge Functions que usam Service Role (bypass de RLS), o que centraliza a autoridade de escrita fora do frontend — relevante para a migração, pois essas functions podem ser reaproveitadas quase sem alteração pelo novo módulo dentro do Studio.
- **Créditos e assinaturas** (`photographer_accounts`, `subscriptions_asaas`) são tabelas de conta do fotógrafo, não exclusivas de uma "galeria" individual — reforça a orientação do usuário de que esses dados devem futuramente virar parte da conta unificada do Studio.

---

## 17. Funcionalidades que dependem especificamente do domínio `gallery.lunarihub.com`

Ocorrências diretas do domínio no código (`lib/galleryUrl.ts`):

1. **`PRODUCTION_GALLERY_DOMAIN = 'https://gallery.lunarihub.com'`** — constante hardcoded usada como fallback/base para:
   - `getGalleryUrl(publicToken, photographerDomain?)` — gera o link público `/g/:token` compartilhado com o cliente final (ex.: enviado por WhatsApp/e-mail). Se `photographerDomain` não for passado, usa sempre o domínio de produção da Gallery.
   - `getReferralUrl(referralCode)` — gera o link de indicação (`/auth?ref=...`), usando o domínio de produção apenas quando `isProductionDomain()` é verdadeiro.
2. **`isProductionDomain()`** — checa `window.location.hostname === 'gallery.lunarihub.com'` (ou subdomínio dela) para decidir comportamento condicional (ex.: qual base usar no link de indicação).
3. **`Index.tsx`** — comentário explícito no código identifica a rota raiz `/` como "Redirecionamento Inteligente da Raiz (gallery.lunarihub.com)", confirmando que esse domínio é a home pública esperada do app.
4. **`gallery-og` (edge function)** — serve meta tags Open Graph dinâmicas para links de galeria compartilhados; embora a function em si não dependa do domínio, a URL final compartilhada (`getGalleryOgUrl`) é montada a partir da URL de functions do Supabase, não do domínio da Gallery diretamente — mas o **link de destino pós-OG** aponta para as rotas `/g/:token` do domínio Gallery.

**Implicação para a migração**: qualquer link já enviado a clientes finais (via WhatsApp/e-mail) usando `gallery.lunarihub.com/g/:token` continuará resolvendo apenas enquanto esse domínio existir e apontar para esta aplicação (ou um redirect dela). A descontinuação do domínio (etapa final, conforme escopo maior do projeto) exigirá:
- Migrar `PRODUCTION_GALLERY_DOMAIN` para `app.lunarihub.com` (ou equivalente) nas funções `getGalleryUrl`/`getReferralUrl`.
- Garantir redirecionamento 301 de `gallery.lunarihub.com/g/*` para o novo domínio/rota por um período de transição, para não quebrar links já distribuídos.
- Revisar `isProductionDomain()` para refletir o novo host canônico.

---

## Itens marcados como "Não confirmado" (resumo)

- Mecanismo de redirecionamento interno da rota legada `/client/:id` dentro de `ClientGallery.tsx`.
- Rota exata de `ClientDeliverGallery.tsx` no roteador (não localizada explicitamente em `App.tsx`).
- Propósito da subpasta `components/deliver/memory/`.
- Nome exato da tabela por trás de `useSettings`/`GlobalSettings` (provável `gallery_settings`).
- Nome exato da tabela de clientes da Gallery usada por `useGalleryClients`.
- Ponto exato de débito de créditos na criação de galeria (`GalleryCreate.tsx`, arquivo de 2534 linhas, não lido integralmente).
- Se `subscriptions_asaas` é compartilhada entre os produtos "Select" e "Transfer" ou se há tabelas distintas.
- Chamada real (local exato no código) que invoca `gallery-update-session-photos` a partir do lunari-gallery.
- Mecanismo de propagação de sessão de auth entre os domínios Gallery e Studio (se existe SSO/cookie compartilhado ou não).
- Uso real de `@react-three/fiber`/`three` no projeto.
- Confirmação de chamada a `user_has_gallery_access` dentro do lunari-gallery.

---

*Documento gerado a partir de leitura direcionada do código-fonte do `lunari-gallery` (sem execução, sem alteração de código, sem comparação com o `lunari-studio`). Serve como base de entrada para a próxima etapa: elaboração do plano de migração propriamente dito.*
