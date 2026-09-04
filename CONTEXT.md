

# Documento de Contexto Tecnico -- Lunari Gestao (Projeto Principal)

> **Projeto**: Lunari Plataforma (Gestao)
> **Stack**: React 18 + Vite + TypeScript + Tailwind CSS + Supabase
> **Dominio Producao**: `app.lunarihub.com`
> **Supabase Project ID**: `tlnjspsywycbudhewsfv`
> **Projeto Irmao**: Lunari Gallery (`gallery.lunarihub.com`) -- compartilha o mesmo banco Supabase

---

## 1. ESTRUTURA E ARQUITETURA

### Padrao de Pastas

```text
src/
  adapters/          # Adaptadores de dados entre formatos
  assets/            # Imagens e recursos estaticos
  components/        # Componentes React organizados por dominio
    admin/           # Painel administrativo
    agenda/          # Modulo de agendamentos
    auth/            # ProtectedRoute, AdminRoute, PlanRestrictionGuard
    clientes/        # CRM / gestao de clientes
    cobranca/        # Modal de cobrancas (InfinitePay/MP)
    crm/             # Historico unificado do cliente
    dashboard/       # Dashboard principal
    financas/        # Modulo financeiro
    galeria/         # Integracao com Gallery
    integracoes/     # Conexoes (MP, InfinitePay, Google Calendar)
    landing/         # Landing page publica
    layout/          # Layout principal (sidebar, header)
    leads/           # Modulo de leads
    onboarding/      # Fluxo de onboarding
    payments/        # SessionPaymentsManager (historico pagamentos)
    precificacao/    # Calculadora de precos
    subscription/    # UI de planos e trial
    tarefas/         # Gestao de tarefas
    workflow/        # Cards de workflow (collapsed/expanded)
    ui/              # shadcn/ui (Radix-based)
  config/            # URLs externas, constantes de planos
  constants/         # Constantes globais
  contexts/          # 6 Context Providers (ver secao 3)
  domain/            # Logica de dominio pura
  hooks/             # ~130 hooks customizados
  integrations/supabase/  # Client + types gerados automaticamente
  pages/             # ~32 paginas/rotas
  services/          # Services (Supabase, pricing, cache, etc.)
  types/             # TypeScript interfaces por dominio
  utils/             # Utilitarios (~60 arquivos)
```

### Rotas Principais (App.tsx)

**Publicas**: `/` (landing), `/auth`, `/reset-password`, `/conteudos`, `/conteudos/:slug`

**Protegidas (sem layout)**: `/escolher-plano`, `/minha-assinatura`, `/onboarding`

**Protegidas (com layout `/app`):**
- `/app` -- Dashboard
- `/app/agenda` -- Agenda
- `/app/clientes` -- CRM
- `/app/clientes/:id` -- Detalhe do cliente
- `/app/workflow` -- Workflow de sessoes
- `/app/configuracoes` -- Configuracoes
- `/app/minha-conta` -- Conta do usuario
- `/app/integracoes` -- Integrações (MP, InfinitePay, Google Cal)
- `/app/leads` -- **Pro only**
- `/app/financas` -- **Pro only**
- `/app/precificacao` -- **Pro only**
- `/app/tarefas` -- **Pro only**
- `/app/analise-vendas` -- **Pro only**
- `/app/admin/*` -- **Admin only** (usuarios, planos, conteudos)

### Hierarquia de Providers

```text
BrowserRouter
  QueryClientProvider
    ThemeProvider
      AuthProvider            ← auth state (user, session)
        ConfigurationProvider ← categorias, pacotes, produtos, status
          WorkflowCacheProvider ← cache de sessoes do workflow
            AppProvider       ← estado global (appointments, clients)
              AgendaProvider  ← estado da agenda
```

---

## 2. BANCO DE DADOS (CRITICO)

### Tabelas Completas (42 tabelas + 5 views)

#### Nucleo do Negocio (CRITICO -- compartilhado com Gallery)

| Tabela | Descricao | Leitura | Escrita |
|--------|-----------|---------|---------|
| `clientes` | Dados de clientes (nome, email, telefone, origem) | Gestao + Gallery | Gestao |
| `clientes_sessoes` | Sessoes/agendamentos confirmados (workflow) | Gestao + Gallery | Gestao + Gallery (via triggers) |
| `clientes_transacoes` | Pagamentos vinculados a sessoes | Gestao + Gallery | Gestao + Webhooks |
| `clientes_documentos` | Documentos/contratos de clientes | Gestao | Gestao |
| `clientes_familia` | Membros da familia do cliente | Gestao | Gestao |
| `appointments` | Agendamentos (pendentes e confirmados) | Gestao | Gestao |
| `cobrancas` | Cobrancas de gateways (InfinitePay, MP) | Gestao + Gallery | Webhooks + Edge Functions |
| `webhook_logs` | Logs de webhooks recebidos | Gestao (admin) | Webhooks |

#### Assinaturas e Acesso (CRITICO -- compartilhado com Gallery)

| Tabela | Descricao |
|--------|-----------|
| `subscriptions_asaas` | **Fonte de verdade** para assinaturas ativas (Asaas) |
| `unified_plans` | Definicoes de planos (precos, capacidades, flags) |
| `plans` | Planos legados (Stripe -- nao mais usado ativamente) |
| `subscriptions` | Subscriptions legadas (Stripe) |
| `allowed_emails` | Emails autorizados com plan_code |
| `user_roles` | Roles (admin, moderator, user) |
| `vip_users` | Usuarios VIP com bypass |
| `profiles` | Perfil do usuario (nome, nicho, cidade, trial dates) |
| `photographer_accounts` | Conta do fotografo (creditos, storage, watermark) |
| `coupons` | Cupons de desconto para checkout |

#### Creditos e Compras (compartilhado com Gallery)

| Tabela | Descricao |
|--------|-----------|
| `credit_ledger` | Historico de operacoes de creditos |
| `credit_purchases` | Compras de creditos pendentes/aprovadas |
| `admin_credit_grants` | Concessoes de creditos pelo admin |
| `gallery_credit_packages` | Pacotes de creditos para venda |

#### Galerias (compartilhado -- Gallery escreve, Gestao le)

| Tabela | Descricao |
|--------|-----------|
| `galerias` | Galerias de fotos (selecao e entrega) |
| `galeria_fotos` | Fotos individuais |
| `galeria_pastas` | Pastas/organizacao |
| `galeria_acoes` | Log de acoes do cliente na galeria |
| `gallery_settings` | Configuracoes da galeria por fotografo |
| `gallery_themes` | Temas visuais |
| `gallery_email_templates` | Templates de email |
| `gallery_discount_presets` | Presets de desconto |

#### Configuracao e Preferencias (somente Gestao)

| Tabela | Descricao |
|--------|-----------|
| `categorias` | Categorias de sessao (ex: Casamento, Ensaio) |
| `pacotes` | Pacotes de servico por categoria |
| `produtos` | Produtos avulsos |
| `etapas_trabalho` | Status customizados do workflow |
| `user_preferences` | Preferencias do usuario |
| `usuarios_integracoes` | Tokens OAuth (MP, Google Calendar) |
| `modelo_de_preco` | Modelos de precificacao |
| `tabelas_precos` | Tabelas de precos por faixa |
| `availability_slots` | Slots de disponibilidade |
| `custom_time_slots` | Horarios customizados |

#### Financeiro (somente Gestao)

| Tabela | Descricao |
|--------|-----------|
| `fin_transactions` | Transacoes financeiras |
| `fin_items_master` | Itens mestres (categorias financeiras) |
| `fin_credit_cards` | Cartoes de credito |
| `fin_recurring_blueprints` | Templates de recorrencia |
| `financial_items` | Itens financeiros legados |

#### Pricing (somente Gestao)

| Tabela | Descricao |
|--------|-----------|
| `pricing_configs` | Configuracoes de pricing |
| `pricing_configuracoes` | Metas e parametros |
| `pricing_custos_estudio` | Custos do estudio |
| `pricing_equipamentos` | Equipamentos e depreciacao |
| `pricing_gastos_pessoais` | Gastos pessoais |
| `pricing_calculadora_estados` | Estados salvos da calculadora |
| `pricing_ignored_transactions` | Transacoes ignoradas no calculo |

#### Outros

| Tabela | Descricao |
|--------|-----------|
| `leads` | Leads de vendas |
| `lead_statuses` | Status customizados de leads |
| `lead_follow_up_config` | Config de follow-up |
| `tasks` | Tarefas |
| `task_statuses`, `task_tags`, `task_people` | Metadata de tarefas |
| `feed_items` | Feed de conteudo |
| `blog_posts` | Posts do blog/conteudos |
| `municipios_ibge` | Municipios brasileiros |
| `app_reload_events` | Eventos de force-reload |
| `system_cache` | Cache de sistema |

### Views

- `extrato_unificado` -- Juncao de fin_transactions + clientes_transacoes
- `crescimento_mensal` -- Metricas de crescimento (admin)
- `faturamento_por_cidade` / `faturamento_por_nicho` / `faturamento_por_cidade_nicho` -- Analytics admin

### Triggers Criticos (NAO MEXER)

1. **`trigger_recompute_session_paid`** em `clientes_transacoes` -- Recalcula `valor_pago` na sessao via `recompute_session_paid()`
2. **`trigger_recalculate_valor_total`** em `clientes_sessoes` -- Recalcula `valor_total` quando base/extras/produtos/desconto mudam
3. **`recalculate_fotos_extras_total`** em `clientes_sessoes` -- Calcula `valor_total_foto_extra`
4. **`ensure_transaction_on_cobranca_paid`** em `cobrancas` -- Safety net: cria transacao se webhook falhou
5. **`sync_appointment_to_session`** em `appointments` -- Sincroniza data/hora para `clientes_sessoes`
6. **`sync_gallery_status_to_session`** em `galerias` -- Sincroniza status da galeria para sessao
7. **`ensure_session_pricing`** em `clientes_sessoes` -- Garante valor_base_pacote
8. **`fix_session_categoria_pacote_inversion`** -- Corrige inversoes categoria/pacote
9. **`validate_regras_congeladas`** -- Aviso se sessao sem regras congeladas
10. **`cleanup_occupied_availability`** em `appointments` -- Remove slots ao confirmar

### RPC Functions Criticas

- **`get_access_state()`** -- Retorna estado de acesso consolidado (admin/vip/trial/subscription)
- **`start_studio_trial()`** -- Ativa trial de 30 dias
- **`create_session_from_appointment()`** -- Cria sessao atomicamente com lock
- **`delete_appointment_cascade()`** -- Deleta appointment + sessao + transacoes
- **`add_session_payment()`** -- Adiciona pagamento com lock
- **`recompute_session_paid()`** -- Recalcula valor_pago
- **`has_role()` / `is_admin()`** -- Verificacao de roles (SECURITY DEFINER)

### Logica de Validacao de Assinaturas e Acesso

**Fluxo completo:**

1. **`get_access_state()` (RPC)** -- Fonte de verdade. Consulta em ordem: `user_roles` (admin) → `allowed_emails` (authorized) → `subscriptions_asaas` (subscription ativa) → `profiles` (trial). Retorna status: `ok`, `suspended`, `no_subscription`, `trial_expired`, `session_expired`, `network_error`.

2. **`useAccessControl` (hook)** -- Chama `get_access_state()` com retry (3 tentativas), cache local, deteccao de erro de rede e sessao expirada. Expoe `accessState`, `hasPro`, `hasGaleryAccess`.

3. **`ProtectedRoute` (componente)** -- Ordem de verificacao:
   - Auth loading → spinner
   - Nao autenticado → `/auth`
   - Offline/network_error → `OfflineScreen`
   - Session expired → `SessionExpiredScreen`
   - Suspended → signOut + `/auth`
   - Trial expired → `/escolher-plano` (exceto rotas isentas)
   - Onboarding incompleto → `/onboarding` (**ANTES** da subscription wall)
   - No subscription → Card com "Escolher Plano"
   - OK → render children

4. **`PlanRestrictionGuard`** -- Bloqueia features Pro para usuarios Starter. Rotas protegidas: leads, financas, precificacao, tarefas, analise-vendas.

---

## 3. AUTENTICACAO E ESTADO

### AuthContext (`src/contexts/AuthContext.tsx`)

- Provider global com Supabase Auth
- Suporta Google OAuth + Email/Password
- `onAuthStateChange` listener + `getSession` na montagem
- Refresh proativo: verifica token a cada 60s, forca refresh se < 5min para expirar
- `getAppBaseUrl()` para redirects dinamicos por dominio

### Outros Contexts

- **ConfigurationContext** -- Categorias, pacotes, produtos, etapas_trabalho, modelo_de_preco. Reativo ao `user.id`.
- **WorkflowCacheContext** -- Cache de `clientes_sessoes` com polling por `updated_at`. Escuta eventos `payment-created`, `session-created`, `appointment-confirmed`.
- **AppContext** -- Estado global de appointments, clientes, metodos de pagamento. Funcoes de CRUD.
- **AgendaContext** -- Estado da agenda (mes/semana, filtros, slots).
- **PricingContext** -- Sistema de precificacao (custos, equipamentos, metas).

### Patterns Importantes

- Todos os providers limpam estado no logout (sem singletons de inicializacao)
- Dados sensíveis NUNCA em localStorage (exceto session do Supabase Auth)
- `valor_pago` e `valor_total` sao SOMENTE leitura no frontend -- calculados por triggers

---

## 4. INTEGRACOES EXTERNAS

### Edge Functions (Supabase -- 28 funcoes)

#### Asaas (Assinaturas)
- `asaas-create-customer` -- Cria cliente no Asaas
- `asaas-create-subscription` -- Cria assinatura (aceita cupons)
- `asaas-create-payment` -- Pagamento unico (planos anuais)
- `asaas-upgrade-subscription` -- Upgrade imediato com prorata
- `asaas-downgrade-subscription` -- Downgrade agendado
- `asaas-cancel-subscription` -- Cancelamento
- `asaas-webhook` -- Webhook central do Asaas

#### InfinitePay (Cobranças)
- `gestao-infinitepay-create-link` -- Gera link (Gestao, via JWT)
- `infinitepay-create-link` -- **Legado** (nao usar)
- `infinitepay-webhook` -- Webhook compartilhado
- `check-payment-status` -- Fallback manual

#### Mercado Pago
- `mercadopago-connect` / `mercadopago-disconnect` -- OAuth
- `mercadopago-create-link` / `mercadopago-create-pix` -- Pagamentos
- `mercadopago-webhook` -- Webhook
- `mercadopago-get-app-id` -- Retorna App ID publico
- `mp-create-validation-payment` -- Pagamento de validacao

#### Gallery (inter-projeto)
- `gallery-create-payment` -- Cria cobranca via Service Role (clientes da galeria)
- `gallery-update-session-photos` -- Atualiza fotos/status da sessao
- `provision-gallery-workflow-statuses` -- Provisiona status de sistema

#### Google Calendar
- `google-calendar-connect/callback/sync/sync-all/disconnect`

#### Outros
- `sync-user-subscription` -- Sincroniza estado de assinatura
- `populate-municipios-ibge` -- Popula tabela de municipios
- `sitemap` -- Gera sitemap dinamico

### Comunicacao com Gallery

- **Redirect via query string**: Gestao redireciona para `gallery.lunarihub.com/gallery/new?session_id=...&cliente_id=...` (ver `src/utils/galleryRedirect.ts`)
- **Dados compartilhados**: Ambos leem/escrevem `galerias`, `galeria_fotos`, `cobrancas`, `clientes_sessoes`
- **Trigger `sync_gallery_status_to_session`**: Atualiza status da sessao quando galeria muda
- **Faturamento isolado**: Gestao usa `gestao-infinitepay-create-link` (JWT), Gallery usa `gallery-create-payment` (Service Role)

### Secrets Necessarios (Supabase Edge Functions)

- `ASAAS_API_KEY`, `ASAAS_ENV` (sandbox/production)
- `INFINITEPAY_API_KEY`
- `MERCADOPAGO_CLIENT_SECRET`, `MERCADOPAGO_CLIENT_ID`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` (para operacoes admin)

---

## 5. ZONAS DE RISCO (NAO REFATORAR SEM SUPERVISAO)

### Nivel CRITICO (pode quebrar pagamentos e acesso)

1. **`get_access_state()` (SQL RPC)** -- Logica de acesso centralizada. Qualquer mudanca afeta AMBOS os projetos. Orquestrar admin → allowed_emails → subscriptions_asaas → trial.

2. **`useAccessControl.ts` + `ProtectedRoute.tsx`** -- Chain de verificacao de acesso. A ORDEM importa (onboarding ANTES de subscription wall). Erro aqui = deadlock de usuarios.

3. **Triggers de `valor_pago` e `valor_total`** -- `trigger_recompute_session_paid`, `recalculate_session_valor_total`, `ensure_transaction_on_cobranca_paid`. Frontend NAO DEVE tentar setar esses campos manualmente.

4. **Edge Functions `asaas-*`** -- Compartilhadas entre Gestao e Gallery. Qualquer mudanca precisa ser testada em ambos. Leem `unified_plans` dinamicamente.

5. **`WorkflowCacheContext.tsx`** -- Cache central do workflow com logica de polling, eventos customizados e deteccao de mudancas em `valor_pago`/`valor_total`. Race conditions historicas ja corrigidas.

6. **`src/integrations/supabase/types.ts`** -- NUNCA EDITAR MANUALMENTE. Gerado automaticamente pelo Supabase. Qualquer mudanca sera sobrescrita.

### Nivel ALTO (logica de negocio complexa)

7. **`AppContext.tsx`** (~900+ linhas) -- Estado global massivo. Gerencia appointments, clientes, integracao agenda-workflow. Alto risco de regressao.

8. **`WorkflowCardCollapsed.tsx` / `WorkflowCardExpanded.tsx`** -- UI mais complexa do sistema. Grid com 10+ colunas, edicao inline, calculos financeiros, integracao com pagamentos e galerias.

9. **`EscolherPlano.tsx` + `EscolherPlanoPagamento.tsx`** -- Logica de overlap detection, prorata, upgrades cross-produto. Afeta faturamento diretamente.

10. **`asaas-webhook/index.ts`** -- Processa eventos de pagamento/assinatura. Gerencia ciclo de vida de creditos, status de assinatura, downgrades pendentes.

11. **`infinitepay-webhook/index.ts` + `mercadopago-webhook/index.ts`** -- Processamento de pagamentos com busca por `ip_order_nsu`. Contrato imutavel definido (ver memoria `infinitepay-official-collections-contract`).

12. **`SessionPaymentsManager.tsx` + `useSessionPayments.ts`** -- Historico de pagamentos por sessao. Bug historico de dessincronizacao ja corrigido (onPaymentUpdate removido).

### Nivel MEDIO (migracoes e utils)

13. **`src/utils/` (60+ arquivos)** -- Muitos sao scripts de migracao one-time. Podem ser removidos com cuidado, mas verificar se algum e chamado em runtime.

14. **`PricingContext.tsx` + services/pricing/*`** -- Sistema de precificacao com calculo de custos, depreciacao, markup. Complexo mas isolado.

15. **RLS Policies** -- Todas as 17 tabelas sensíveis tem RLS com `auth.uid() = user_id` + `TO authenticated`. Qualquer nova tabela DEVE seguir o mesmo padrao.

### Regras Imutaveis para a IA Externa

- `valor_pago` e `valor_total` em `clientes_sessoes` sao calculados por triggers SQL. O frontend NUNCA deve tentar atualiza-los diretamente.
- `session_id` em `clientes_sessoes` e formato texto (ex: `workflow-1771610846081-03ol8fqdrkbm`), nao UUID. O campo `id` e UUID.
- Webhooks DEVEM buscar cobrancas primeiro por `ip_order_nsu`, depois por `id`.
- Todas as Edge Functions `asaas-*` sao compartilhadas -- nao duplicar.
- A tabela `unified_plans` e a unica fonte de verdade para precos -- nao hardcodar valores.
- `profiles.studio_trial_ends_at` controla o trial -- ativado via RPC `start_studio_trial()`.
- Nunca usar foreign key para `auth.users` -- usar `profiles` com `user_id`.
- **PWA Precache & ChunkLoadError (CRÍTICO):** NUNCA permitir que chunks dinâmicos pesados (como `mermaid-*.js`, `wasm-*.js`, gramáticas shiki) entrem no precache do Service Worker (`globIgnores` em `vite.config.ts`). Ao alterar dependências ou lazy imports, verificar o impacto no tamanho dos chunks e no ServiceWorker (`sw.js`). O `RootErrorBoundary` deve sempre auto-recuperar chunks obsoletos pós-deploy limpando `CacheStorage` e desregistrando Service Workers sem apagar os tokens de autenticação do Supabase (`sb-*`).

