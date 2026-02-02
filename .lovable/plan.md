

# Plano: Completar Configuracoes de Pagamento Mercado Pago

## Diagnostico Atual

Apos analise detalhada do codigo, identifiquei o seguinte estado:

### O que JA EXISTE

| Componente | Status | Descricao |
|------------|--------|-----------|
| `useIntegracoes.ts` | Parcial | Conecta/desconecta MP mas **NAO salva** habilitarPix, habilitarCartao, maxParcelas |
| `MercadoPagoCard.tsx` | Parcial | Exibe badges de PIX/Cartao mas **NAO tem formulario** de configuracao |
| `mercadopago-create-link` | Incompleto | **NAO le** dados_extras do banco - usa valores fixos |
| `mercadopago-create-pix` | Funcional | Cria PIX corretamente |
| `ChargeModal.tsx` | Funcional | Interface de cobranca funcionando |
| `gallery-create-payment` | Referencia | Le dados_extras corretamente (podemos usar como modelo) |

### O que FALTA implementar

| Item | Prioridade | Impacto |
|------|------------|---------|
| Modal de configuracoes MP | Alta | Usuario nao consegue configurar parcelas/PIX/Cartao |
| Funcao updateMercadoPagoSettings no hook | Alta | Nao salva preferencias no banco |
| Edge Function ler dados_extras | Alta | Ignora configuracoes do fotografo |
| Passar maxParcelas do modal para edge function | Media | Parcelas nao respeitam limite |

---

## Solucao Proposta

### 1. Criar Modal de Configuracoes do Mercado Pago

Novo componente `MercadoPagoSettingsModal.tsx`:

```text
+------------------------------------------+
|  Configuracoes Mercado Pago              |
+------------------------------------------+
|                                          |
|  METODOS DE PAGAMENTO                    |
|  [ ] Habilitar PIX                       |
|  [ ] Habilitar Cartao de Credito         |
|                                          |
|  PARCELAS                                |
|  [Selecione] 1x, 3x, 6x, 12x             |
|                                          |
|  (informativo sobre taxas)               |
|                                          |
|         [Cancelar]  [Salvar]             |
+------------------------------------------+
```

### 2. Adicionar Funcoes ao useIntegracoes

```typescript
interface MercadoPagoSettings {
  habilitarPix: boolean;      // default: true
  habilitarCartao: boolean;   // default: true
  maxParcelas: number;        // 1, 3, 6 ou 12 (default: 12)
}

// Novas funcoes:
mercadoPagoSettings: MercadoPagoSettings | null;
updateMercadoPagoSettings: (settings: Partial<MercadoPagoSettings>) => Promise<void>;
```

### 3. Atualizar Edge Function mercadopago-create-link

Adicionar leitura de dados_extras:

```typescript
// ANTES (atual):
const preferenceData = {
  payment_methods: {
    installments: installments || 12,  // Fixo
    excluded_payment_types: [],         // Vazio
  },
};

// DEPOIS (corrigido):
const { data: integracao } = await supabase
  .from('usuarios_integracoes')
  .select('access_token, dados_extras')
  .eq('user_id', user.id)
  .eq('provedor', 'mercadopago')
  .single();

const settings = integracao.dados_extras as {
  habilitarPix?: boolean;
  habilitarCartao?: boolean;
  maxParcelas?: number;
};

const pixHabilitado = settings?.habilitarPix !== false;
const cartaoHabilitado = settings?.habilitarCartao !== false;
const maxParcelas = Math.min(Math.max(1, settings?.maxParcelas || 12), 24);

const excludedTypes = [{ id: 'ticket' }];
if (!cartaoHabilitado) {
  excludedTypes.push({ id: 'credit_card' });
  excludedTypes.push({ id: 'debit_card' });
}

const preferenceData = {
  payment_methods: {
    excluded_payment_types: excludedTypes,
    installments: maxParcelas,
  },
};
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/components/integracoes/MercadoPagoSettingsModal.tsx` | Criar | Modal com switches PIX/Cartao + select parcelas |
| `src/hooks/useIntegracoes.ts` | Modificar | Adicionar mercadoPagoSettings e updateMercadoPagoSettings |
| `src/components/integracoes/MercadoPagoCard.tsx` | Modificar | Adicionar botao "Configurar" que abre o modal |
| `src/components/integracoes/PagamentosTab.tsx` | Modificar | Passar props de settings para MercadoPagoCard |
| `supabase/functions/mercadopago-create-link/index.ts` | Modificar | Ler dados_extras e aplicar exclusoes |

---

## Fluxo Completo Apos Implementacao

```text
1. Fotografo acessa Integracoes > Pagamentos
2. Conecta Mercado Pago via OAuth
3. Clica em "Configurar" no card MP
4. Modal abre com opcoes:
   - Switch PIX (on/off)
   - Switch Cartao (on/off)
   - Select parcelas (1x, 3x, 6x, 12x)
5. Ao salvar: dados_extras atualizado no banco
6. Ao criar cobranca: Edge Function le dados_extras
   - Monta excluded_payment_types baseado em PIX/Cartao
   - Define installments conforme maxParcelas
7. Cliente final ve apenas opcoes habilitadas no checkout
```

---

## Interface do Modal de Configuracoes

```text
+------------------------------------------------------------+
|  Configuracoes do Mercado Pago                        [X]  |
+------------------------------------------------------------+
|                                                            |
|  METODOS DE PAGAMENTO ACEITOS                              |
|  Escolha quais metodos seus clientes poderao usar          |
|                                                            |
|  +------------------------------------------------------+  |
|  |  [Logo PIX]  PIX                        [  Toggle  ] |  |
|  |              Pagamento instantaneo                   |  |
|  +------------------------------------------------------+  |
|  |  [Card Icon] Cartao de Credito          [  Toggle  ] |  |
|  |              Parcelado ou a vista                    |  |
|  +------------------------------------------------------+  |
|                                                            |
|  LIMITE DE PARCELAS                                        |
|  Ate quantas vezes o cliente pode parcelar                 |
|                                                            |
|  [ 3x sem juros                              v ]           |
|                                                            |
|  (i) As taxas do Mercado Pago variam conforme              |
|      o numero de parcelas selecionado.                     |
|                                                            |
+------------------------------------------------------------+
|                        [Cancelar]  [Salvar Configuracoes]  |
+------------------------------------------------------------+
```

---

## Detalhes Tecnicos

### Estrutura dados_extras no Banco

```json
{
  "habilitarPix": true,
  "habilitarCartao": true,
  "maxParcelas": 3,
  "is_default": true,
  "live_mode": true
}
```

### Valores Validos para maxParcelas

| Valor | Exibicao |
|-------|----------|
| 1 | A vista |
| 3 | Ate 3x |
| 6 | Ate 6x |
| 12 | Ate 12x |

### Comportamento de Exclusao no Checkout MP

- Se `habilitarCartao = false`: exclui `credit_card` e `debit_card`
- Se `habilitarPix = false`: nao temos como excluir PIX diretamente no Checkout Pro, mas podemos ocultar a opcao no modal de cobranca do Gestao

---

## Resumo

A implementacao consiste em:

1. **Novo Modal**: Formulario visual para configurar preferencias MP
2. **Atualizar Hook**: Funcoes para ler/salvar dados_extras
3. **Corrigir Edge Function**: Ler configuracoes do banco antes de criar preferencia
4. **Atualizar UI**: Botao "Configurar" no MercadoPagoCard abrindo o modal

Isso permitira que o fotografo escolha se aceita PIX, cartao, e ate quantas parcelas - configuracoes que serao respeitadas em todas as cobrancas geradas via modal no Workflow e CRM.

