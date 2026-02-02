# Plano: Ativar Gateway de Pagamento no Workflow e CRM

## ✅ IMPLEMENTADO

### Mudanças Realizadas

| Arquivo | Ação | Status |
|---------|------|--------|
| `supabase/functions/mercadopago-get-app-id/index.ts` | Nova Edge Function que retorna APP_ID público | ✅ Criado e deployed |
| `supabase/config.toml` | Adicionar config da nova function | ✅ Atualizado |
| `src/hooks/useIntegracoes.ts` | Substituir `import.meta.env` por chamada à Edge Function | ✅ Atualizado |

### Resultado

O fluxo de conexão OAuth do Mercado Pago agora funciona:
1. Frontend chama Edge Function `mercadopago-get-app-id`
2. Edge Function retorna o APP_ID configurado no Supabase secrets
3. Frontend gera URL OAuth e redireciona usuário para autorização MP

### Funcionalidades Ativas

| Funcionalidade | Status |
|----------------|--------|
| Conectar InfinitePay | ✅ Funciona (apenas digitar handle) |
| Conectar Mercado Pago | ✅ OAuth funcionando |
| Gerar Pix (MP) | ✅ Já implementado |
| Gerar Link (MP) | ✅ Já implementado |
| Gerar Link (InfinitePay) | ✅ Já implementado |
| Webhook processa pagamento | ✅ Cria transação e atualiza valor_pago |
| Histórico unificado | ✅ Exibe origem (Manual, Pix MP, Link MP, InfinitePay) |
