

# Configurações de Pagamento Independentes por Projeto + Migração

## Problema Atual

Ambos os projetos (Gestão e Gallery) leem e escrevem **exatamente o mesmo** `dados_extras` na tabela `usuarios_integracoes`. Qualquer alteração em um projeto afeta imediatamente o outro. Não há como ter configurações diferentes (ex: 12x no Gestão, 6x na Gallery).

## Arquitetura Proposta

Usar o próprio JSON `dados_extras` para armazenar configurações por contexto, sem alterar o schema do banco:

```text
dados_extras (atual):
{
  "habilitarPix": true,
  "maxParcelas": 12,
  "absorverTaxa": false,
  "ireiAntecipar": true,
  ...
}

dados_extras (novo):
{
  "habilitarPix": true,       ← campos raiz = fallback/legado
  "maxParcelas": 12,
  ...
  "gestao_settings": {        ← override específico do Gestão
    "maxParcelas": 12,
    "absorverTaxa": false,
    "ireiAntecipar": true,
    "repassarTaxaAntecipacao": false
  },
  "gallery_settings": {       ← override específico da Gallery
    "maxParcelas": 6,
    "absorverTaxa": true,
    "ireiAntecipar": false,
    "repassarTaxaAntecipacao": false
  }
}
```

**Leitura**: Cada projeto lê seu `_settings` sub-objeto; se não existir, faz fallback para os campos raiz (100% backward compatible).

**Escrita**: Cada projeto grava apenas no seu `_settings` sub-objeto + mantém os campos raiz sincronizados com o último save (para webhooks e Edge Functions que leem campos raiz).

## Plano de Implementação (Gestão)

### 1. Criar utilitário `src/utils/paymentSettingsContext.ts`

Funções puras para ler/escrever settings por contexto:

```typescript
type SettingsContext = 'gestao' | 'gallery';

// Extrai settings do contexto, com fallback para raiz
function getContextSettings(dadosExtras: AsaasData, context: SettingsContext): AsaasSettings

// Mescla settings do contexto de volta no dados_extras
function setContextSettings(dadosExtras: AsaasData, context: SettingsContext, settings: AsaasSettings): AsaasData

// Copia settings de um contexto para outro
function migrateSettings(dadosExtras: AsaasData, from: SettingsContext, to: SettingsContext): AsaasData
```

Campos migráveis (apenas configurações operacionais, nunca credenciais):
- `maxParcelas`, `absorverTaxa`, `habilitarPix`, `habilitarCartao`, `habilitarBoleto`
- `ireiAntecipar`, `repassarTaxaAntecipacao`, `incluirTaxaAntecipacao`

Mesma lógica para `MercadoPagoData` (campos: `maxParcelas`, `absorverTaxa`, `habilitarPix`, `habilitarCartao`).

### 2. Atualizar `src/hooks/usePaymentIntegration.ts`

- Leitura: usar `getContextSettings(dados_extras, 'gestao')` ao invés de ler direto
- Escrita: usar `setContextSettings()` + manter campos raiz atualizados
- Nova mutation `migrateFromGallery`: chama `migrateSettings(dados_extras, 'gallery', 'gestao')` e salva

### 3. Adicionar botão "Migrar da Gallery" no `PaymentConfigDrawer.tsx`

No drawer do Asaas e MP (quando já configurados), adicionar seção no topo:

```text
┌──────────────────────────────────┐
│ 🔄 Migrar configurações         │
│ Copiar configurações da Gallery  │
│ [Migrar da Gallery]              │
│                                  │
│ ⚠ Apenas configurações opera-   │
│ cionais serão copiadas (parce-   │
│ las, taxas, antecipação). Cre-   │
│ denciais permanecem inalteradas. │
└──────────────────────────────────┘
```

O botão aparece apenas se `gallery_settings` existir no `dados_extras` (= Gallery já configurou algo diferente). Caso contrário, mensagem "Configurações sincronizadas com a Gallery".

### 4. Atualizar `PaymentSettings.tsx`

Adicionar indicador sutil quando settings divergem entre projetos:
- Badge "Configuração independente" ao lado do provider se `gestao_settings !== gallery_settings`

## Documentação para o Projeto Gallery

### 5. Gerar documento `/mnt/documents/gallery-payment-settings-migration.md`

Documento técnico com:

1. **Arquitetura**: Explicação do modelo `dados_extras` com sub-objetos por contexto
2. **Código a portar**: O utilitário `paymentSettingsContext.ts` (idêntico, apenas muda o contexto de leitura para `'gallery'`)
3. **Mudanças no hook**: `usePaymentIntegration.ts` do Gallery deve usar `getContextSettings(dados_extras, 'gallery')` para leitura e `setContextSettings(..., 'gallery', ...)` para escrita
4. **UI**: Adicionar botão "Migrar do Gestão" no `PaymentConfigDrawer.tsx` da Gallery
5. **Backward compatibility**: Se `gallery_settings` não existir, ler campos raiz (comportamento atual)
6. **Edge Functions**: Nenhuma mudança necessária — webhooks continuam lendo campos raiz, que são atualizados pelo último save de qualquer projeto

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/utils/paymentSettingsContext.ts` | Criar — funções puras para ler/escrever/migrar settings por contexto |
| `src/hooks/usePaymentIntegration.ts` | Modificar — usar context utils para leitura/escrita, adicionar mutation `migrateFromGallery` |
| `src/components/integracoes/PaymentConfigDrawer.tsx` | Modificar — adicionar seção "Migrar da Gallery" no drawer |
| `src/components/integracoes/PaymentSettings.tsx` | Modificar — badge de "configuração independente" |
| `/mnt/documents/gallery-payment-settings-migration.md` | Criar — documentação completa para o projeto Gallery |

