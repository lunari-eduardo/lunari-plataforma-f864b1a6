# Plano de Correção: Status de Sistema do Gallery para Admin

## ✅ IMPLEMENTAÇÃO CONCLUÍDA

### O que foi feito:

**1. Migration SQL - Correção de Dados Existentes**
- Inserida etapa "Enviado para seleção" com `is_system_status = true` para o admin
- Atualizada "Seleção finalizada" com `is_system_status = true`
- Corrigido status da sessão do cliente Euclides

**2. Edge Function Atualizada**
- `provision-gallery-workflow-statuses` agora aceita `email` além de `userId`
- Busca userId automaticamente pelo email no profiles
- Retorna sucesso se usuário ainda não cadastrado (provisionamento no primeiro acesso)

**3. AllowedEmailsManager.tsx Atualizado**
- Ao adicionar email com PRO+Gallery: chama Edge Function para provisionar
- Ao atualizar plano para PRO+Gallery: chama Edge Function para provisionar

**4. Hook useProvisionGalleryStatuses Criado**
- Auto-provisiona status de sistema no primeiro login de usuários PRO+Gallery
- Verifica se já existem as etapas obrigatórias antes de provisionar
- Integrado no AppContent para execução automática

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Usuário recebe PRO + Gallery                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AllowedEmailsManager → Chama provision-gallery-workflow-statuses           │
│                                                                             │
│  OU                                                                         │
│                                                                             │
│  useProvisionGalleryStatuses (login) → Verifica e provisiona se necessário  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Etapas provisionadas com is_system_status = true                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  • "Enviado para seleção" ✅                                                │
│  • "Seleção finalizada" ✅                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Trigger sync_gallery_status_to_session funciona corretamente               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Galeria enviada → Sessão atualizada automaticamente ✅                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/...` | Criada migration para corrigir dados do admin |
| `supabase/functions/provision-gallery-workflow-statuses/index.ts` | Suporte a email lookup |
| `src/components/admin/AllowedEmailsManager.tsx` | Integração com Edge Function |
| `src/hooks/useProvisionGalleryStatuses.ts` | Novo hook de auto-provisioning |
| `src/App.tsx` | Hook integrado no AppContent |
