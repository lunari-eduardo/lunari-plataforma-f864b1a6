

# Plano: Expandir Painel Admin com Asaas, Creditos e Storage

## Estado Atual

O painel admin (`AdminUsuarios.tsx`) tem 3 tabs funcionais:
- **Usuarios**: lista `profiles` + `subscriptions` (legado Stripe) + VIP/admin badges. Acoes: VIP e Galery (via tabela `subscriptions` legada)
- **Estrategia**: analytics com filtros e KPIs
- **Emails Autorizados**: CRUD com plan_codes antigos (`pro_galery_monthly`, `pro_monthly`, `starter_monthly`)

RPCs ja existentes: `admin_grant_credits`, `get_transfer_storage_bytes`
RLS: `photographer_accounts` tem policy admin, `subscriptions_asaas` NAO tem

## O que falta implementar

### 1. Migration SQL -- RLS + plan_code update
- Adicionar policy SELECT admin em `subscriptions_asaas`: `has_role(auth.uid(), 'admin')`
- Adicionar policy UPDATE admin em `subscriptions_asaas` para cancelar/reativar

### 2. Tab Usuarios -- Expandir com dados Asaas
- Substituir leitura de `subscriptions` (legado) por `subscriptions_asaas`
- Adicionar colunas: **Assinatura Asaas** (plan_type + status), **Creditos Select** (photo_credits), **Storage** (free_transfer_bytes)
- Buscar `photographer_accounts` para cada usuario (photo_credits, free_transfer_bytes, gallery_credits)
- Recalcular metricas usando `subscriptions_asaas` (ACTIVE = ativo, nao mais `subscription_status`)

### 3. Modal "Gerenciar Creditos" (novo)
- Ao clicar em acao do usuario, abre modal com:
  - Saldo atual de `photo_credits` e `gallery_credits`
  - Input para quantidade a adicionar
  - Input para motivo
  - Chama RPC `admin_grant_credits(_target_user_id, _amount, _reason)`

### 4. Modal "Ajustar Storage" (novo)
- Exibe `free_transfer_bytes` atual (formatado em GB)
- Input para novo valor em GB
- Atualiza `photographer_accounts.free_transfer_bytes` diretamente

### 5. Modal "Ver Assinaturas Asaas" (novo)
- Lista todas as `subscriptions_asaas` do usuario selecionado
- Mostra: plan_type, status, billing_cycle, value_cents, next_due_date, pending_downgrade
- Acoes: Cancelar (chama edge function `asaas-cancel-subscription`), Reativar

### 6. Tab Assinaturas (nova tab)
- Listar todas as `subscriptions_asaas` com status ACTIVE/PENDING/OVERDUE
- KPIs: Total assinantes, MRR (soma value_cents dos ACTIVE), distribuicao por plano
- Filtros: plan_type, status, billing_cycle
- Tabela com: usuario (email), plano, status, valor, ciclo, proxima cobranca, downgrades agendados

### 7. Atualizar Emails Autorizados -- plan_codes novos
- Substituir `PLAN_OPTIONS` antigos por novos codigos Asaas:
  - `combo_completo` (Combo Completo -- Studio + Select + Transfer)
  - `combo_pro_select2k` (Studio Pro + Select 2k)
  - `studio_pro` (Studio Pro)
  - `studio_starter` (Starter)
- Manter logica de `get_access_state` que ja mapeia `plan_code` de `allowed_emails`

### 8. Remover acoes legadas
- Remover acao "Galery" que manipula tabela `subscriptions` legada
- Substituir por acoes baseadas em `subscriptions_asaas` e `allowed_emails`

## Arquivos a modificar/criar

| Arquivo | Acao |
|---------|------|
| Migration SQL | RLS admin para subscriptions_asaas |
| `src/pages/AdminUsuarios.tsx` | Refatorar para ler subscriptions_asaas, adicionar tab Assinaturas, modais de creditos/storage/assinaturas |
| `src/components/admin/AllowedEmailsManager.tsx` | Atualizar PLAN_OPTIONS para codigos Asaas |
| `src/components/admin/AdminSubscriptionsTab.tsx` | Novo componente: tab de assinaturas |
| `src/components/admin/AdminUserActions.tsx` | Novo componente: modais de creditos, storage e assinaturas |

## Ordem de implementacao

1. Migration SQL (RLS)
2. Atualizar AllowedEmailsManager com novos plan_codes
3. Criar AdminSubscriptionsTab
4. Criar AdminUserActions (modais)
5. Refatorar AdminUsuarios para integrar tudo

