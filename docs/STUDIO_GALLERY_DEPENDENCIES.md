# Dependências e Impactos no Studio (Migração Gallery)

> Documento de análise do projeto **lunari-studio**, criado para mapear as dependências e pontos de impacto para a futura integração do módulo Gallery.
>
> Complementa o `GALLERY_MIGRATION_INVENTORY.md`.

---

## 1. App Shell, Layout e Navegação
- **Onde está no código:** `src/App.tsx`, `src/app-photographer/PhotographerApp.tsx`, `src/components/layout/Layout.tsx`.
- **O que já existe:** O Studio possui seu próprio App Shell, com navegação estruturada via Sidebar (provavelmente no `<Layout />`) ou header global consolidado.
- **Adaptação:** O layout da Gallery, que atualmente possui navegação própria 100% via header horizontal (`Layout.tsx` no Gallery), deverá ser totalmente descartado ou readaptado para se encaixar dentro do `<Layout />` do Studio.
- **Relação com Gallery:** O módulo integrado da Gallery funcionará como um container/rota protegida dentro da navegação nativa do Studio.

## 2. Estrutura de rotas (`/app/*`)
- **Onde está no código:** `src/app-photographer/PhotographerApp.tsx`.
- **O que já existe:** Já existe a rota `/app/gallery`, que aponta para um `GalleryPlaceholder`. Além disso, existem rotas públicas institucionais (site) como `/gallery/select` e `/gallery/transfer`.
- **Adaptação:** As rotas internas de gestão da Gallery (dashboard, listagem, edição) serão injetadas dentro de `/app/gallery/*`. Rotas para o cliente final (visualização da galeria) podem precisar de caminhos isolados que não usem o `<Layout />` protegido do Studio (ex: `/g/:token`).

## 3. Autenticação e Contexto do Usuário
- **Onde está no código:** `src/contexts/AuthContext.tsx`, `src/App.tsx`.
- **O que já existe:** O Studio já gere a autenticação via Supabase com seus próprios providers e controle de estado de sessão global (`AuthProvider`).
- **Adaptação:** O frontend da Gallery herdará a sessão autenticada nativa do Studio, sem necessitar do seu próprio AuthContext isolado.
- **Riscos:** Nenhum, a migração é simplificada pois o projeto de banco de dados é o mesmo.

## 4. Perfil / Minha Conta
- **Onde está no código:** `src/pages/MinhaConta.tsx`, `src/pages/Configuracoes.tsx`.
- **O que já existe:** O Studio concentra a edição de dados do perfil do fotógrafo, estúdio, e configurações.
- **Adaptação:** As configurações de fotógrafo específicas da Gallery (`Settings.tsx` do lunari-gallery) deverão ser consolidadas na página de `Configuracoes.tsx` ou em abas específicas dentro da conta no Studio.

## 5. Assinaturas, Planos, e Sistema de Créditos
- **Onde está no código:** `src/pages/EscolherPlano.tsx`, `src/pages/MinhaAssinatura.tsx`, `src/components/admin/AdminUserActions.tsx`.
- **O que já existe:** O Studio já tem ciência dos créditos (exibindo `photo_credits`, `gallery_credits`, `free_transfer_bytes` no painel Admin).
- **Adaptação:** O checkout e exibição de saldos não pertencerão a um fluxo independente do Gallery. O Studio assumirá como a conta principal do usuário onde as cobranças e o consumo de créditos (Select) ou assinatura (Transfer) serão geridos globalmente em `MinhaAssinatura.tsx` ou equivalente.
- **Indique e Ganhe:** Também passará a ser funcionalidade da conta principal do Studio (Hub global), agregando bônus para a conta como um todo e não só para o módulo Gallery.

## 6. Clientes e Estrutura de Dados dos Clientes
- **Onde está no código:** `src/pages/Clientes`, `src/pages/ClienteDetalhe`.
- **O que já existe:** O Studio tem um CRM robusto (Tabela `clientes`). O Gallery legado pode ter tabelas paralelas ou criar registros autônomos de clientes.
- **Adaptação/Substituição:** A regra de ouro é **não duplicar clientes**. As galerias passarão a selecionar clientes primariamente a partir da base CRM nativa do Studio. O client manager e seletores no código legado do Gallery deverão ser substituídos pelos componentes de busca de clientes do Studio.
- **Risco:** Dados históricos do Gallery podem apontar para referências de cliente diferentes que precisarão ser tratadas para convergirem ao registro único no Studio.

## 7. Supabase e Tabelas Compartilhadas
- **Onde está no código:** `src/integrations/supabase/types.ts`.
- **O que já existe:** O Studio aponta para a mesma base Supabase. As tabelas da Gallery (`galerias`, logs no `audit_log`, etc.) já estão mapeadas no types gerados do Studio.
- **Relação com Gallery:** O acesso a dados migrará nativamente, os repositórios poderão apenas chamar `supabase.from('galerias')` como o Gallery já o faz, aproveitando o mesmo client do Studio.

## 8. Storage e Infraestrutura R2
- **Onde está no código:** Edge Functions no Studio (`gestao-migrate-supabase-to-r2`, `gestao-r2-public-upload`, `gestao-r2-signed-url`, `gestao-r2-upload`, `gestao-r2-delete`).
- **O que já existe:** O Studio possui suporte amplo ao Cloudflare R2 por meio destas Edge Functions.
- **Adaptação:** O upload de imagens pesadas (fotos para a galeria) continuará utilizando o R2. O código de upload legado na Gallery poderá consumir estas mesmas functions ou hooks adaptados disponíveis no ecossistema do Studio.

## 9. Componentes ou Serviços já integrados com Gallery
- **Onde está no código:** 
  - `src/modules/gallery/index.ts` (API para checagem de acesso e controle de seleções de galeria).
  - `src/components/cobranca/CobrancaFinalidadeSelector.tsx` (Lista galerias como finalidade em cobranças).
  - `src/components/cobranca/ExtraChargeModal.tsx` (Chama function `gallery-create-payment` para cobrar extras da galeria).
- **O que já existe:** O Studio já é capaz de consultar galerias, listar fotos de uma sessão na cobrança e emitir faturamento em nome do serviço de galeria via integrações RPC (`useGalleryExtraCalc`).
- **Relação com Gallery:** O Studio agirá não só como hospedeiro, mas como "pai" das transações financeiras oriundas das escolhas na Gallery integrada.

## 10. Criação Assistida de Galerias via Query Params (JSON, Redirects)
- **Onde está no código:** `src/utils/galleryRedirect.ts` (`buildGalleryNewUrl` e `buildGalleryDeliverUrl`).
- **O que já existe:** O Studio monta links contendo query params robustos (`session_id`, `cliente_nome`, pacote, modelo de cobrança, preco da foto extra) que encaminham o usuário para a URL externa atual da Gallery (`https://gallery.lunarihub.com`).
- **Dependências/Riscos:** Segundo a regra estipulada, **este fluxo será um dos últimos a ser descontinuado**. Durante a migração e coexistência (old Gallery funcionando enquanto migra-se), o Studio deverá continuar enviando usuários (redirect externo) para criar galerias através desse script até que a versão interna de criação (dentro de `/app/gallery/new`) esteja completamente validada.

## 11. Edge Functions e Permissões
- **Onde está no código:** `supabase/functions/`.
- **O que já existe no Studio:** Functions como `gallery-create-payment`, `gallery-update-session-photos`, `provision-gallery-workflow-statuses`, bem como toda a bateria de funções Asaas e MercadoPago.
- **Relação com Gallery:** As regras de RLS (banco) e as Functions são universais (mesmo projeto backend). O frontend do Studio apenas ganhará o poder de invocar mais endpoints ou chamar direto a tabela `galerias`.

## 12. Funcionalidade que permanecerá no Studio
Toda a parte de aprovação de orçamento, controle de pipeline no workflow, geração de faturas (Financeiro) e agendamento (Agenda/Calendário) é escopo nativo do Studio e não deve ser replicada no módulo integrado da Gallery. A Gallery fará o papel focado de upload, seleção e visualização de aprovação de fotos para o cliente final.
