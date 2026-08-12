# Plano de Migração: Lunari Gallery para Lunari Studio

> Documento de planejamento arquitetural e cronograma técnico para a unificação dos sistemas.
>
> **Base de Referência:** `GALLERY_MIGRATION_INVENTORY.md` e `STUDIO_GALLERY_DEPENDENCIES.md`.

---

## 1. Visão Geral e Diretrizes Arquiteturais

A meta é unificar a experiência do usuário, transformando a **Lunari Gallery** em um módulo nativo protegido do **Lunari Studio**. Como o banco de dados (Supabase) já é **compartilhado** entre os dois sistemas, não haverá "migração de dados" no sentido estrito (exportação/importação). A migração consistirá na **absorção do frontend, fluxos de negócio e integrações visuais** para dentro da aplicação principal (Studio).

### Regras Críticas Inegociáveis
1. **Coexistência e Estabilidade:** A Gallery antiga (`gallery.lunarihub.com`) continuará operando **100% de forma independente e funcional** durante toda a construção da nova estrutura.
2. **Criação de Galerias Intocada:** O atual fluxo de redirecionamento com Query Params do Studio para a Gallery antiga não sofrerá nenhuma interferência até a Etapa Final (quando a nova Gallery for a provedora oficial).
3. **Zero Duplicação de Clientes:** O novo módulo não terá uma listagem autônoma de "Clientes de Galeria"; todo vínculo de galeria buscará referências exclusivas no CRM do Studio.
4. **Design System:** Aproveitar lógica, mas a camada visual da Gallery migrada deve pertencer ao ecossistema do Studio (layouts consistentes com o App Shell atual).

---

## 2. Roteiro e Definições de Execução

### A. O que deve ser feito primeiro
- Criação das rotas e do esqueleto do módulo vazio dentro do `/app` do Studio (Etapa 1).
- Unificação das áreas financeiras globais (Créditos, Assinaturas, Indique e Ganhe) na central "Minha Conta" do Studio (Etapa 2).

### B. O que depende de outras etapas
- A listagem de galerias do fotógrafo (Etapa 4) depende da integração prévia da busca no CRM (Etapa 3) para vincular os cards aos clientes corretos do Studio.
- O fluxo de Cliente Final (Etapa 6) depende que o módulo de criação/edição interno (Etapa 5) esteja funcional para realizar os testes ponta a ponta.

### C. O que pode ser desenvolvido em paralelo
- Enquanto as telas administrativas do fotógrafo (Dashboard, Edição, Configurações) estão sendo transferidas (Etapas 4 e 5), o frontend da rota pública do cliente final (grids de fotos, lightbox, gate com senha - Etapa 6) pode ser desenvolvido e testado de forma simultânea e independente, pois não depende do App Shell do Studio.

### D. O que deve permanecer intocado até o final
- O repositório legado da Gallery (não comitar alterações estruturais ou visuais desnecessárias).
- O arquivo `utils/galleryRedirect.ts` do Studio e qualquer botão de "Nova Galeria" nos cards do Workflow atual do Studio.

---

## 3. Plano de Etapas

### Etapa 1: Estrutura Base e App Shell
- **Objetivo:** Estabelecer a "casa" do novo módulo, definindo as rotas em `/app/gallery/*` perfeitamente encaixadas na navegação (Sidebar/Header) do Studio.
- **O que será migrado:** `App.tsx` (rotas do gallery-legacy) para `PhotographerApp.tsx`.
- **Componentes Envolvidos:** `PhotographerApp.tsx`, `Layout.tsx`, Criação da tela Placeholder central (`/app/gallery/dashboard`).
- **Dependências:** Nenhuma.
- **Riscos:** Conflito de injeção de CSS (Tailwind/Radix UI) entre o legado adaptado e as regras globais do Studio.
- **Validações:** O acesso manual à rota `/app/gallery/dashboard` renderiza o App Shell do Studio sem quebras e injeta o container correto.
- **Critério de conclusão:** Ambiente base pronto para receber componentes legados refatorados.

### Etapa 2: Unificação Financeira e de Conta
- **Objetivo:** Trazer Créditos, Armazenamento (Transfer), Assinatura e Indique/Ganhe para a "Minha Conta" do Studio.
- **O que será migrado:** Todo o módulo de compras da Gallery (Hooks como `usePhotoCredits`, `useAsaasSubscription`, pacotes do Select, painel de consumo do Transfer e mecânica do `useReferrals`).
- **Componentes Envolvidos:** `MinhaConta.tsx`, `MinhaAssinatura.tsx`, tabelas `photographer_accounts`, `referrals`.
- **Riscos:** Afetar o fluxo financeiro principal do Studio por superposição de edge functions ou bugs de checkout.
- **Validações:** O fotógrafo consegue comprar créditos ou assinar planos de transfer usando exclusivamente o Studio, e o salto reflete imediatamente (ambos usam a mesma tabela).
- **Critério de conclusão:** As funcionalidades financeiras de galeria operam de forma nativa e segura dentro das configurações do Studio.

### Etapa 3: Integração do CRM (Clientes Únicos)
- **Objetivo:** Eliminar a gestão autônoma de clientes da Gallery e atrelar as galerias ao CRM do Studio.
- **O que será migrado:** Descarte da tela de Clientes da Gallery. Substituição dos modais de `ClientSelect` do legado pelo seletor de clientes do Studio.
- **Componentes Envolvidos:** Seletor de Cliente nativo do Studio, `ClienteDetalhe.tsx` (Adição da tab/seção "Galerias").
- **Riscos:** Galerias legadas perderem associação na interface por diferença no formato dos dados de clientes (legacy vs novo CRM).
- **Validações:** Acessar o `ClienteDetalhe` no Studio deve carregar e exibir corretamente as galerias que já existem e estão atreladas a esse usuário no banco de dados compartilhado.
- **Critério de conclusão:** Studio é a fonte única e absoluta de consulta e seleção de clientes para os formulários de galeria.

### Etapa 4: Listagem e Gestão de Galerias (Dashboard)
- **Objetivo:** Habilitar a visualização das galerias já existentes dentro do Studio, substituindo a navegação do legado.
- **O que será migrado:** O `Dashboard.tsx` do Gallery (abas de Seleção e Entrega, filtros de status, cards e gráficos) para dentro da rota `/app/gallery/dashboard`.
- **Componentes Envolvidos:** `GalleryCard`, grids, queries em memória de galerias (`useSupabaseGalleries`).
- **Riscos:** Excesso de carga em client-side se a tabela tiver muitas galerias (já mapeado no legado que o data fetch não possui paginação no DB).
- **Validações:** Confirmar se as galerias listadas batem idênticamente com o que o fotógrafo vê logado no Gallery antigo.
- **Critério de conclusão:** O fotógrafo visualiza todo seu histórico e status de galerias de forma consistente com a UI nativa do Studio.

### Etapa 5: Criação, Edição e Configurações (Visão do Fotógrafo)
- **Objetivo:** Migrar o formulário massivo de criação/edição e o upload.
- **O que será migrado:** `GalleryCreate.tsx`, `GalleryEdit.tsx`, configurações do Fotógrafo (`Settings.tsx`, Marcas D'água, Temas) e o `PhotoUploader` (usando Edge Functions R2 existentes).
- **Componentes Envolvidos:** Layout de tabs do Studio, lógica de precificação (frozen rules), filas de upload R2, `GalleryDetail.tsx`.
- **Riscos:** Integridade de pastas do R2 (rotas e prefixos de arquivo) no momento do upload.
- **Validações:** Criar e editar uma galeria internamente pelo Studio e garantir que ela esteja operante (mesmo sendo um upload feito pela UI nova, o R2 deve receber corretamente).
- **Critério de conclusão:** Fotógrafo é capaz de realizar todo o ciclo de vida e parametrização sem sair do Studio.

### Etapa 6: Telas Públicas do Cliente Final
- **Objetivo:** Otimizar e incorporar a visualização pública (rotas `/g/:token`) ao Studio.
- **O que será migrado:** Toda a UI de cliente final (`ClientGallery.tsx`, visualizações editoriais, seleção de imagens, tela de senha e checkout de fotos extras).
- **Componentes Envolvidos:** `MasonryGrid`, `Lightbox`, fluxo de pagamento integrado, edge functions de visitantes.
- **Riscos:** Erros na recuperação de `public_token` que invalidem URLs legadas já despachadas aos clientes.
- **Validações:** Realizar o ciclo completo de cliente (login com e-mail no gate, escolha de fotos, superação da franquia e checkout transparente) através da nova URL.
- **Critério de conclusão:** A visão pública do cliente está funcionando perfeitamente em um subdomínio/rota gerida pelo Studio (ex: `app.lunarihub.com/g/:token` ou rota dedicada).

---

## 4. Etapa Final: Transição Definitiva e Desativação

Esta fase ocorre exclusivamente **após todas as etapas anteriores terem sido aprovadas, validadas com clientes reais e submetidas a QA.**

### Passos de Execução da Etapa Final
1. **Alterar Definitivamente a Criação de Galerias:**
   - Desativar a construção de URLs externas (`utils/galleryRedirect.ts`).
   - Mudar os botões de "Nova Galeria" no Workflow do Studio para navegarem internamente usando React Router (ex: `navigate('/app/gallery/new', { state: { ...sessionData } })`).
2. **Validar Últimos Fluxos:**
   - Confirmar se o envio de e-mails, recebimento de pagamentos extras e as chamadas de API internas cruzadas (ex. `gallery-update-session-photos`) operam sem ressalvas na nova arquitetura nativa.
3. **Redirect Público (301):**
   - Configurar regras de Proxy/Rewrite para que qualquer visitante acessando `gallery.lunarihub.com/g/:token` seja redirecionado transparentemente para a nova rota pública do Studio. (Protege links velhos já enviados no WhatsApp).
4. **Descontinuar Acesso Fotógrafo:**
   - Configurar o antigo repositório do Gallery para bloquear login de fotógrafos e forçar um aviso: *"A Lunari Gallery agora está dentro do Lunari Studio. Clique aqui para acessar."*
5. **Remover Dependências e Limpeza:**
   - Após alguns meses de estabilidade monitorada, desativar em definitivo o servidor frontend legado do `gallery.lunarihub.com` e apagar o código não utilizado.

---

## 5. Decisões Pendentes (Em Análise)

### A. Roteamento de Subdomínio para o Cliente Final
- **Problema:** Onde a galeria final deve hospedar sua URL para o cliente? Atualmente é `gallery.lunarihub.com/g/:token`. Migrar para `app.lunarihub.com/g/:token` mistura rotas SaaS (B2B) com rotas públicas B2C, podendo afetar SEO ou carregar bundles desnecessários de Admin no carregamento do cliente.
- **Recomendação:** Avaliar a criação de uma sub-aplicação (roteador independente) dentro do mesmo monorepo do Studio, separando o entry-point de fotógrafos (`/app`) do entry-point do cliente final (ex: `/g/`), utilizando code-splitting rigoroso, garantindo carregamento ultrarrápido para o cliente.

### B. SSO e Autenticação (Período de Transição)
- **Problema:** Durante a fase de construção (Etapas 4 e 5), se quisermos permitir que "early adopters" visualizem a galeria no Studio mas precisem pular para o legado se encontrarem um bug, a sessão atual propagará de um subdomínio para outro? 
- **Recomendação:** Considerando a política de não alterar o sistema base, não implementar SSO forçado. O login do Studio bastará para operar a nova Gallery. Se precisarem recorrer ao antigo, se logarão no antigo. 

---
*Este plano representa a consolidação final para execução faseada. A migração deve prosseguir estritamente mantendo a resiliência do sistema atual.*
