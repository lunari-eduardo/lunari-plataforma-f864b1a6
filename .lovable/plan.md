
# Plano: Implementar PIX Manual com Geracao Local de QR Code

## Diagnostico

O problema esta no `ChargeModal.tsx` linha 96:

```typescript
// ERRADO: pix_manual esta sendo convertido para 'mercadopago'
const provedor = selectedProvider === 'infinitepay' ? 'infinitepay' : 'mercadopago';
```

Quando o usuario seleciona "PIX Manual", o codigo converte para `mercadopago` e chama a Edge Function, gerando um link do Mercado Pago em vez de usar a chave PIX configurada localmente.

## Dados Disponiveis

O usuario ja tem PIX Manual configurado no banco:
```json
{
  "chavePix": "51998287948",
  "nomeTitular": "Eduardo Valmor Diehl",
  "tipoChave": "telefone"
}
```

## Arquitetura da Solucao

```text
FLUXO PIX MANUAL (local, sem Edge Function):
+-------------------+      +-------------------+      +-------------------+
|  ChargeModal      | ---> | generatePixPayload| ---> | PixManualSection  |
|  (detecta pix_    |      | (utils/pixUtils)  |      | (exibe QR + copia)|
|   manual)         |      |                   |      |                   |
+-------------------+      +-------------------+      +-------------------+
         |
         v
+-------------------+
|  Salva cobranca   |
|  no banco (local) |
|  status=pendente  |
+-------------------+
```

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/utils/pixUtils.ts` | Criar | Gerador de PIX EMV payload (codigo fornecido pelo usuario) |
| `src/components/cobranca/PixManualSection.tsx` | Criar | UI para exibir QR Code + copia e cola do PIX |
| `src/components/cobranca/ChargeModal.tsx` | Modificar | Detectar pix_manual e usar fluxo local |
| `src/hooks/useCobranca.ts` | Modificar | Adicionar funcao `createPixManualCharge()` |
| `src/types/cobranca.ts` | Modificar | Adicionar campos para PIX Manual no CobrancaResponse |

---

## Detalhes da Implementacao

### 1. Novo Utilitario: `src/utils/pixUtils.ts`

Implementar o gerador de PIX EMV payload conforme codigo fornecido:

- Funcao `crc16()` para calculo do checksum
- Funcao `emvField()` para formatar campos EMV
- Funcao `normalizarChavePix()` para adicionar +55 em telefones
- Funcao principal `generatePixPayload()` que retorna o payload EMV valido

### 2. Novo Componente: `src/components/cobranca/PixManualSection.tsx`

Interface visual para PIX Manual:

```text
+------------------------------------------+
|                                          |
|     [QR CODE 200x200]                    |
|     (gerado via biblioteca qrcode)       |
|                                          |
|  PIX Copia e Cola:                       |
|  +------------------------------------+  |
|  | 00020126580014br.gov.bcb.pix01... |  |
|  +------------------------------------+  |
|         [Copiar Codigo PIX]              |
|                                          |
|  (!) Pagamento requer confirmacao manual |
|                                          |
|  [Enviar via WhatsApp]                   |
+------------------------------------------+
```

Props:
- `pixPayload`: string (codigo EMV gerado)
- `valor`: number
- `clienteWhatsapp?`: string
- `onConfirmPayment?`: () => void (para confirmar manualmente)

### 3. Modificar `ChargeModal.tsx`

Separar o fluxo de geracao baseado no provedor:

```typescript
const handleGenerateCharge = async () => {
  if (!selectedProvider) return;

  if (selectedProvider === 'pix_manual') {
    // Fluxo local: gerar PIX EMV e salvar cobranca no banco
    const result = await createPixManualCharge({
      clienteId,
      sessionId,
      valor,
      descricao: descricao || undefined,
    });
    
    if (result.success) {
      setCurrentCharge({
        pixCopiaCola: result.pixPayload,
        status: 'pendente',
      });
    }
  } else {
    // Fluxo via Edge Function (MP ou InfinitePay)
    const provedor = selectedProvider === 'infinitepay' ? 'infinitepay' : 'mercadopago';
    const result = await createLinkCharge({ ... });
    // ...
  }
};
```

Adicionar renderizacao condicional:

```typescript
{selectedProvider === 'pix_manual' && (
  <PixManualSection
    pixPayload={currentCharge?.pixCopiaCola}
    valor={valor}
    clienteWhatsapp={clienteWhatsapp}
    status={currentCharge?.status}
    loading={creatingCharge}
    onGenerate={handleGenerateCharge}
    onConfirmPayment={handleConfirmPixManual}
  />
)}

{(selectedProvider === 'mercadopago_link' || selectedProvider === 'infinitepay') && (
  <ChargeLinkSection ... />
)}
```

### 4. Modificar `useCobranca.ts`

Adicionar funcao para criar cobranca PIX Manual localmente (sem Edge Function):

```typescript
const createPixManualCharge = async (request: CreateCobrancaRequest): Promise<CobrancaResponse> => {
  setCreatingCharge(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Buscar configuracao do PIX Manual do usuario
    const { data: integracao } = await supabase
      .from('usuarios_integracoes')
      .select('dados_extras')
      .eq('user_id', user.id)
      .eq('provedor', 'pix_manual')
      .eq('status', 'ativo')
      .single();

    if (!integracao?.dados_extras) {
      throw new Error('PIX Manual nao configurado');
    }

    const { chavePix, nomeTitular } = integracao.dados_extras as {
      chavePix: string;
      nomeTitular: string;
    };

    // Gerar payload EMV localmente
    const pixPayload = generatePixPayload({
      chavePix,
      nomeBeneficiario: nomeTitular,
      valor: request.valor,
      identificador: sessionId?.substring(0, 20) || '***',
    });

    // Salvar cobranca no banco
    const { data: cobranca, error } = await supabase
      .from('cobrancas')
      .insert({
        user_id: user.id,
        cliente_id: request.clienteId,
        session_id: request.sessionId,
        valor: request.valor,
        descricao: request.descricao,
        tipo_cobranca: 'pix',
        provedor: 'pix_manual',
        status: 'pendente',
        mp_pix_copia_cola: pixPayload, // Reutiliza campo existente
      })
      .select()
      .single();

    if (error) throw error;

    toast.success('PIX gerado com sucesso!');
    await fetchCobrancas();

    return {
      success: true,
      cobranca: mapCobranca(cobranca),
      pixPayload,
    };
  } catch (error: any) {
    console.error('Error creating PIX Manual:', error);
    toast.error(error.message || 'Erro ao gerar PIX');
    return { success: false, error: error.message };
  } finally {
    setCreatingCharge(false);
  }
};

// Confirmar pagamento manualmente
const confirmPixManualPayment = async (chargeId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('cobrancas')
      .update({ 
        status: 'pago', 
        data_pagamento: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', chargeId);

    if (error) throw error;

    toast.success('Pagamento confirmado!');
    await fetchCobrancas();
    return true;
  } catch (error) {
    console.error('Error confirming payment:', error);
    toast.error('Erro ao confirmar pagamento');
    return false;
  }
};
```

### 5. Modificar `src/types/cobranca.ts`

Adicionar campo para payload do PIX no response:

```typescript
export interface CobrancaResponse {
  success: boolean;
  cobranca?: Cobranca;
  error?: string;
  provedor?: ProvedorPagamento;
  // Pix specific (Mercado Pago)
  qrCode?: string;
  qrCodeBase64?: string;
  pixCopiaCola?: string;
  // PIX Manual specific
  pixPayload?: string;  // NOVO
  // Link specific
  paymentLink?: string;
  checkoutUrl?: string;
}
```

---

## Biblioteca para QR Code

Para renderizar o QR Code no componente `PixManualSection`, usaremos a biblioteca `qrcode` que gera imagens a partir do payload EMV:

```typescript
import QRCode from 'qrcode';

// Gerar QR Code como Data URL
const qrCodeDataUrl = await QRCode.toDataURL(pixPayload, {
  width: 256,
  margin: 2,
  color: { dark: '#000000', light: '#ffffff' }
});
```

Sera necessario adicionar a dependencia: `npm install qrcode @types/qrcode`

---

## Fluxo Completo Apos Implementacao

```text
1. Usuario abre ChargeModal
2. Seleciona "PIX Manual"
3. Clica em "Gerar PIX"
4. Sistema:
   a) Busca dados_extras do PIX Manual (chavePix, nomeTitular)
   b) Gera payload EMV com generatePixPayload()
   c) Salva cobranca no banco com status=pendente
   d) Renderiza QR Code + codigo copia e cola
5. Usuario copia ou envia via WhatsApp
6. Cliente paga fora do sistema
7. Usuario clica em "Confirmar Pagamento" 
8. Sistema atualiza status para 'pago' e cria transacao
```

---

## Resumo das Mudancas

| Componente | Mudanca |
|------------|---------|
| `pixUtils.ts` | Novo - Gerador de payload EMV PIX |
| `PixManualSection.tsx` | Novo - UI com QR Code e copia/cola |
| `ChargeModal.tsx` | Separar fluxo para pix_manual |
| `useCobranca.ts` | Adicionar createPixManualCharge e confirmPixManualPayment |
| `cobranca.ts` | Adicionar pixPayload ao response |

Resultado: PIX Manual gera QR Code local usando a chave configurada, sem chamar Mercado Pago.
