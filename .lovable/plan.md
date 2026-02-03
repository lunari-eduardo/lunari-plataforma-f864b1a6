
# Plano: Melhorar Modal de Cobrança com Seleção de Provedor

## Diagnóstico do Problema

O modal de cobrança atual tem os seguintes problemas:

1. **Modal não se destaca do modal pai** - O ChargeModal abre sobre o SessionPaymentsManager mas visualmente não fica claro que é um novo modal
2. **UI confusa** - Exibe "Pix" e "Link" lado a lado, mas o usuário não sabe qual provedor está usando
3. **Lógica invertida** - Atualmente seleciona o TIPO de cobrança (pix/link), quando deveria selecionar o PROVEDOR (PIX Manual, InfinitePay, Mercado Pago)
4. **Sem default inteligente** - Não usa o provedor padrão configurado nas integrações

---

## Arquitetura Proposta

```text
ANTES (atual):
┌───────────────────────────────────────┐
│  Forma de Cobrança                    │
│  ┌────────┐  ┌────────┐               │
│  │  PIX   │  │  Link  │               │
│  │Imediato│  │Pix+Card│               │
│  └────────┘  └────────┘               │
└───────────────────────────────────────┘

DEPOIS (proposto):
┌───────────────────────────────────────┐
│  Meio de Cobrança                     │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ [logo] PIX (Mercado Pago) ✓ Pad │  │
│  │        Confirmação automática   │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ [logo] InfinitePay              │  │
│  │        Pix + Cartão             │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ [logo] Mercado Pago             │  │
│  │        Pix + Cartão até 12x     │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/cobranca/ChargeModal.tsx` | Modificar | Refatorar para usar lista de provedores com logos |
| `src/components/cobranca/ProviderSelector.tsx` | Criar | Novo componente para lista de provedores |
| `src/components/cobranca/ProviderRow.tsx` | Criar | Row individual de provedor com logo e badge |
| `src/hooks/useCobranca.ts` | Modificar | Adicionar `getAvailableProviders()` e `defaultProvider` |
| `src/types/cobranca.ts` | Modificar | Adicionar `pix_manual` ao tipo ProvedorPagamento |

---

## Detalhes da Implementação

### 1. Novo Componente ProviderRow

```text
┌────────────────────────────────────────────────────────┐
│ [Logo 32x32]  PIX (Mercado Pago)         [✓ Padrão]   │
│               Confirmação automática via QR Code       │
└────────────────────────────────────────────────────────┘
```

**Props:**
- `provider`: 'pix_mercadopago' | 'mercadopago' | 'infinitepay' | 'pix_manual'
- `logo`: string (path do logo)
- `name`: string (nome exibido)
- `description`: string (descrição curta)
- `isDefault`: boolean
- `selected`: boolean
- `onClick`: () => void

### 2. Novo Componente ProviderSelector

Lista todos os provedores disponíveis (conectados) com:
- Logo oficial de cada provedor
- Nome do provedor
- Descrição (tipo de pagamento)
- Badge "Padrão" no provedor configurado como default
- Estado de seleção visual

### 3. Modificações no ChargeModal

**Novo estado:**
```typescript
// Antes
const [selectedMethod, setSelectedMethod] = useState<TipoCobranca>('pix');

// Depois
type SelectedProvider = 'pix_mercadopago' | 'mercadopago_link' | 'infinitepay' | 'pix_manual';
const [selectedProvider, setSelectedProvider] = useState<SelectedProvider | null>(null);
```

**Lógica de geração:**
- `pix_mercadopago` → Chama `createPixCharge()` (MP)
- `mercadopago_link` → Chama `createLinkCharge()` com provedor MP
- `infinitepay` → Chama `createLinkCharge()` com provedor InfinitePay
- `pix_manual` → Exibe QR Code manual (sem integração)

### 4. Modal com Maior Destaque

Para resolver o problema de sobreposição visual:

```css
/* Adicionar ao DialogContent do ChargeModal */
className="... z-[60] shadow-2xl border-2 border-border"
```

E adicionar backdrop mais escuro ou overlay visual.

### 5. Modificações no useCobranca

Adicionar função para buscar provedores disponíveis:

```typescript
interface AvailableProvider {
  id: 'pix_mercadopago' | 'mercadopago_link' | 'infinitepay' | 'pix_manual';
  name: string;
  description: string;
  logo: string;
  isDefault: boolean;
  provedor: ProvedorPagamento;
}

const getAvailableProviders = async (): Promise<AvailableProvider[]> => {
  // Busca integrações ativas do usuário
  // Retorna lista formatada para o seletor
};
```

---

## Fluxo de Interação

```text
1. Usuário clica em "Cobrar" no SessionPaymentsManager
2. ChargeModal abre com overlay mais escuro
3. Lista de provedores é carregada (apenas os conectados)
4. Provedor padrão já vem selecionado
5. Usuário pode mudar selecionando outro provedor
6. Baseado na seleção:
   - Se PIX MP: mostra seção de gerar Pix com QR Code
   - Se MP Link: mostra seção de gerar Link
   - Se InfinitePay: mostra seção de gerar Link
   - Se PIX Manual: mostra chave PIX para copiar (sem QR automático)
7. Ao gerar, usa a função correta do hook
```

---

## Visual dos Provedores

| Provedor | Logo | Nome | Descrição |
|----------|------|------|-----------|
| `pix_mercadopago` | pix-logo.png | PIX | Confirmação automática |
| `mercadopago_link` | mercadopago-logo.png | Mercado Pago | Pix + Cartão até Xx |
| `infinitepay` | infinitepay-logo.png | InfinitePay | Pix + Cartão |
| `pix_manual` | pix-logo.png | PIX Manual | Confirmação manual |

---

## Lógica de Disponibilidade

Apenas provedores CONECTADOS aparecem na lista:

```typescript
const availableProviders = [];

if (mercadoPagoStatus === 'conectado') {
  // Adiciona PIX MP se habilitarPix === true
  if (mercadoPagoSettings?.habilitarPix !== false) {
    availableProviders.push({ id: 'pix_mercadopago', ... });
  }
  // Adiciona Link MP se habilitarCartao === true ou habilitarPix === true
  availableProviders.push({ id: 'mercadopago_link', ... });
}

if (infinitePayStatus === 'conectado') {
  availableProviders.push({ id: 'infinitepay', ... });
}

if (pixManualStatus === 'conectado') {
  availableProviders.push({ id: 'pix_manual', ... });
}
```

---

## Resultado Esperado

1. **Modal se destaca** - Overlay mais escuro + borda mais visível
2. **Provedores claros** - Lista com logos oficiais de cada meio de pagamento
3. **Default inteligente** - Provedor padrão já vem selecionado
4. **Comportamento correto** - Cada provedor gera o tipo de cobrança apropriado
5. **Informativo** - Usuário sabe exatamente qual serviço está usando
