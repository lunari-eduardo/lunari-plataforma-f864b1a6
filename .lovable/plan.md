

# Refatorar Página de Pagamentos para o padrão Gallery

## Objetivo

Substituir a UI fragmentada de pagamentos do Gestão (cards separados por provedor + modais) pela UI unificada do Gallery (lista compacta + Sheet lateral), mantendo a mesma aparência e comportamento dos screenshots.

## Contexto Atual vs Desejado

**Gestão atual**: `PagamentosTab` renderiza `ActiveMethodsList` + 4 cards individuais (`MercadoPagoCard`, `InfinitePayCardNew`, `PixManualCard`, `AsaasCard`) + `MercadoPagoSettingsModal`. Cada card tem seu próprio estado e lógica de formulário.

**Gallery (desejado)**: `PaymentSettings` renderiza duas seções ("Recebimento ativo" + "Outras formas de pagamento") com `PaymentConfigDrawer` (Sheet lateral) que abre o formulário de configuração de cada provedor.

## Plano de Implementação

### 1. Criar `src/hooks/usePaymentIntegration.ts`

Novo hook no Gestão, portado do Gallery. Usa `useQuery` + `useMutation` para ler/escrever em `usuarios_integracoes`. Substitui o hook `useIntegracoes` (que é imperativo com `useState`/`useEffect`) por uma abordagem declarativa com React Query.

- Adaptar URLs do Supabase para o projeto Gestão
- Adaptar `redirect_uri` do Mercado Pago OAuth para a URL do Gestão
- Manter tipos exportados: `PaymentProvider`, `PixKeyType`, `AsaasData`, `MercadoPagoData`, etc.

### 2. Criar `src/assets/payment-logos/index.ts`

Barrel file que re-exporta os logos existentes em `src/assets/`:
```typescript
import pixLogo from '@/assets/pix-logo.png';
import infinitepayLogo from '@/assets/infinitepay-logo.png';
import mercadopagoLogo from '@/assets/mercadopago-logo.png';
import asaasLogo from '@/assets/asaas-logo.png';
export { pixLogo, infinitepayLogo, mercadopagoLogo, asaasLogo };
```

### 3. Criar `src/components/integracoes/PaymentSettings.tsx`

Componente portado do Gallery. Renderiza:
- **Seção "Recebimento ativo"**: Lista com ícone verde, logo, nome, badge "Padrão", summary (PIX + Cartao 12x), botão engrenagem + menu dropdown (Definir padrão / Desativar)
- **Seção "Outras formas de pagamento"**: Lista com círculo cinza, logo esmaecida, nome, descrição, botão "+ Adicionar"

Usa o novo `usePaymentIntegration` hook.

### 4. Criar `src/components/integracoes/PaymentConfigDrawer.tsx`

Componente portado do Gallery. Sheet lateral (`SheetContent side="right"`) com formulários por provedor:
- **PIX Manual**: Tipo de chave (select), chave PIX, nome do titular
- **InfinitePay**: Handle com prefixo @
- **Mercado Pago**: Botão conectar OAuth (se desconectado) ou toggles PIX/Cartão + parcelamento (se conectado)
- **Asaas**: API Key (se novo), ambiente, toggles PIX/Cartão/Boleto, parcelamento, antecipação, ver taxas

### 5. Atualizar `src/components/preferencias/IntegracoesTab.tsx`

Substituir `<PagamentosTab ...>` com dezenas de props por `<PaymentSettings />` auto-contido (sem props — busca dados internamente via hook).

### 6. Manter arquivos antigos (não deletar)

Os componentes antigos (`MercadoPagoCard`, `AsaasCard`, etc.) podem estar sendo usados em outros pontos. Não serão deletados, apenas deixarão de ser importados pela `IntegracoesTab`.

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/usePaymentIntegration.ts` | Criar — hook React Query portado do Gallery |
| `src/assets/payment-logos/index.ts` | Criar — barrel de logos |
| `src/components/integracoes/PaymentSettings.tsx` | Criar — componente principal portado |
| `src/components/integracoes/PaymentConfigDrawer.tsx` | Criar — drawer lateral portado |
| `src/components/preferencias/IntegracoesTab.tsx` | Modificar — usar `PaymentSettings` no lugar de `PagamentosTab` |

## Adaptações Gallery → Gestão

- URLs Supabase: usar importação local `supabase` do Gestão
- Auth context: `useAuth` do Gestão em vez de `useAuthContext` do Gallery
- OAuth redirect: URL do Gestão em vez de `gallery.lunarihub.com`
- Logos: reusar os PNGs existentes em `src/assets/`
- Sheet component: já existe no Gestão (`src/components/ui/sheet.tsx`)

