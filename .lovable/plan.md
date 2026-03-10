

# Fix: Modal de Cobranças — 3 Problemas

## 1. Modal não se destaca do fundo

**Causa**: O `ChargeModal` abre sobre o `SessionPaymentsManager` (outro Dialog), mas não há desfoque no modal de trás.

**Correção**: Adicionar classe `backdrop-blur-sm` ao overlay do ChargeModal e garantir que o `z-[60]` já existente funcione. Também aplicar uma opacidade maior no overlay (`bg-black/60`) para destacar visualmente.

No `ChargeModal.tsx`, usar `DialogContent` com overlay customizado via className no `Dialog`:
```tsx
<DialogContent className="... z-[60]" overlayClassName="backdrop-blur-sm bg-black/60 z-[59]">
```
Se o DialogContent não suportar `overlayClassName`, ajustar o componente `DialogOverlay` no `ui/dialog.tsx` para aceitar isso, ou usar CSS com seletor `:has`.

**Abordagem simplificada**: Adicionar CSS global que aplica blur no overlay quando há múltiplos dialogs abertos.

---

## 2. Provedores em dropdown em vez de lista vertical

**Causa**: `ProviderSelector` renderiza cada provedor como um `ProviderRow` (card clicável), ocupando ~280px verticais com 4 provedores.

**Correção**: Substituir a lista de cards por um `Select` (Radix) com cada provedor como `SelectItem` contendo logo + nome + descrição. Isso reduz de ~280px para ~40px (altura do select fechado).

**Arquivo**: `src/components/cobranca/ProviderSelector.tsx`
- Trocar o map de `ProviderRow` por um `<Select>` com `<SelectItem>` customizado
- Manter auto-select do provider padrão
- Cada item mostra: logo (16x16) + nome + badge "Padrão" se aplicável

---

## 3. Asaas: duas opções (PIX presencial + Link checkout)

**Causa**: Atualmente, ao selecionar Asaas, o `AsaasCheckoutSection` mostra tabs PIX/Cartão/Boleto inline — misturando cobrança presencial com remota.

**Correção**: Quando Asaas é selecionado, mostrar **duas opções**:

### a) **PIX Presencial** (botão "Gerar QR Code")
- Abre um **novo Dialog** com QR Code grande + código copia/cola
- Ideal para cobrança física na sessão
- Reutiliza a lógica `generatePix` existente do `AsaasCheckoutSection`

### b) **Gerar Link de Checkout** (botão "Gerar Link")  
- Chama Edge Function para criar a cobrança e gera URL para página de checkout
- Cria nova rota pública `/checkout/:cobrancaId` com:
  - Logo do fotógrafo (da tabela `profiles`)
  - Valor e descrição
  - Tabs: PIX / Cartão / Boleto (reutiliza lógica do `AsaasCheckoutSection`)
  - Design branded com cores do sistema
- O link pode ser enviado via WhatsApp/copiado

### Arquivos modificados/criados:

| Arquivo | Ação |
|---------|------|
| `src/components/cobranca/ProviderSelector.tsx` | Refatorar para Select dropdown |
| `src/components/cobranca/ProviderRow.tsx` | Remover (não mais necessário) |
| `src/components/cobranca/ChargeModal.tsx` | Ajustar overlay blur + integrar nova seção Asaas |
| `src/components/cobranca/AsaasChargeOptions.tsx` | **Novo** — Tela com 2 opções (PIX presencial / Link) |
| `src/components/cobranca/AsaasPixModal.tsx` | **Novo** — Modal com QR Code grande para cobrança presencial |
| `src/components/ui/dialog.tsx` | Permitir customizar overlay (backdrop-blur) |
| `src/pages/PublicCheckout.tsx` | **Novo** — Página pública de checkout transparente |
| `src/App.tsx` | Adicionar rota `/checkout/:cobrancaId` |
| Edge Function `gestao-asaas-create-checkout` | **Novo** — Cria cobrança e retorna URL pública |

### Fluxo simplificado:

```text
ChargeModal
  └─ Select dropdown (provedor)
       └─ Asaas selecionado
            ├─ [QR Code PIX] → AsaasPixModal (dialog separado com QR grande)
            └─ [Gerar Link]  → Gera URL → /checkout/:id (página pública branded)
```

