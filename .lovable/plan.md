

# Plano: Corrigir Geração de PIX BR Code Inválido

## Diagnóstico Detalhado

Analisei o código PIX gerado:
```
00020126360014br.gov.bcb.pix0114+555199828794852040000530398654045.005802BR5920EDUARDO VALMOR DIEHL6009SAO PAULO62240520workflow-176998247116304EE6D
```

### Problemas Identificados

| Problema | Campo | Valor Atual | Valor Esperado |
|----------|-------|-------------|----------------|
| ❌ Hífen no txId | 62.05 | `workflow-1769982471163` | Apenas `[A-Za-z0-9]` |
| ❌ txId muito longo | 62.05 | 23 caracteres | Máximo 25, mas sem caracteres especiais |

### Especificação Oficial do txId (Campo 62.05)

Conforme o Manual de Padrões para Iniciação do PIX do Banco Central:
- **Caracteres permitidos**: Apenas alfanuméricos `[A-Za-z0-9]`
- **Comprimento**: 1 a 25 caracteres
- **Não permitidos**: Hífens `-`, underscores `_`, espaços e outros caracteres especiais
- **Valor padrão**: Se não houver identificador, usar `***`

O sessionId do Supabase é um UUID: `workflow-17699824711...` que contém hífens, causando a invalidação do código.

---

## Modificações Necessárias

### Arquivo: `src/utils/pixUtils.ts`

**1. Criar função para sanitizar o txId:**

```typescript
// Remove caracteres não-alfanuméricos do identificador
function sanitizeTxId(id: string): string {
  if (!id || id === '***') return '***';
  
  // Remove tudo que não seja A-Za-z0-9
  const sanitized = id.replace(/[^A-Za-z0-9]/g, '');
  
  // Se ficou vazio após sanitização, usar ***
  if (!sanitized) return '***';
  
  // Limitar a 25 caracteres
  return sanitized.substring(0, 25);
}
```

**2. Atualizar a função `generatePixPayload()`:**

Linha 80 atual:
```typescript
const txId = identificador.substring(0, 25);
```

Nova implementação:
```typescript
const txId = sanitizeTxId(identificador);
```

**3. Validação adicional de campos:**

Garantir que o nome do beneficiário também não tenha caracteres inválidos (já está sendo tratado pela função `normalizeText`, mas podemos reforçar).

---

## Código Corrigido Completo

```typescript
/**
 * PIX BR Code (EMV) Generator
 * Generates valid PIX payment codes following Brazilian Central Bank standards
 */

// CRC16-CCITT calculation (required for PIX standard)
function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// Format EMV field (ID + length + value)
function emvField(id: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${id}${length}${value}`;
}

// Remove accents and special characters, keep only A-Z 0-9 and allowed chars
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^A-Za-z0-9 ]/g, '')   // Remove special chars except space
    .toUpperCase()
    .trim();
}

// Sanitize txId - CRITICAL: only alphanumeric allowed
function sanitizeTxId(id: string): string {
  if (!id || id === '***') return '***';
  
  // Remove everything that is not A-Za-z0-9
  const sanitized = id.replace(/[^A-Za-z0-9]/g, '');
  
  // If empty after sanitization, use default
  if (!sanitized) return '***';
  
  // Max 25 characters
  return sanitized.substring(0, 25);
}

// Normalize PIX key - add country code for phone numbers
function normalizarChavePix(chave: string): string {
  let chaveLimpa = chave.trim();
  
  // If it looks like a phone number (starts with digit), format with country code
  if (/^[0-9]/.test(chaveLimpa)) {
    // Remove non-numeric characters
    chaveLimpa = chaveLimpa.replace(/\D/g, '');
    
    // If 10 or 11 digits (Brazilian phone), add +55 country code
    if (chaveLimpa.length === 10 || chaveLimpa.length === 11) {
      chaveLimpa = '+55' + chaveLimpa;
    }
  }
  
  return chaveLimpa;
}

export interface PixPayloadParams {
  chavePix: string;
  nomeBeneficiario: string;
  valor: number;
  cidade?: string;
  identificador?: string;
}

/**
 * Generates a valid PIX EMV payload (BR Code)
 * This payload can be used to generate QR codes or as "copia e cola"
 */
export function generatePixPayload({
  chavePix,
  nomeBeneficiario,
  valor,
  cidade = 'SAO PAULO',
  identificador = '***',
}: PixPayloadParams): string {
  // Normalize PIX key (add +55 for phone numbers)
  const chaveNormalizada = normalizarChavePix(chavePix);
  
  // Format and sanitize inputs
  const nomeFormatado = normalizeText(nomeBeneficiario).substring(0, 25);
  const cidadeFormatada = normalizeText(cidade).substring(0, 15);
  const valorFormatado = valor.toFixed(2);
  
  // CRITICAL: txId must be alphanumeric only [A-Za-z0-9]
  const txId = sanitizeTxId(identificador);

  // Build EMV payload
  let payload = '';

  // 00 - Payload Format Indicator (mandatory)
  payload += emvField('00', '01');

  // 26 - Merchant Account Information (PIX)
  const pixAccountInfo = emvField('00', 'br.gov.bcb.pix') + emvField('01', chaveNormalizada);
  payload += emvField('26', pixAccountInfo);

  // 52 - Merchant Category Code (0000 = not specified)
  payload += emvField('52', '0000');

  // 53 - Transaction Currency (986 = BRL)
  payload += emvField('53', '986');

  // 54 - Transaction Amount
  if (valor > 0) {
    payload += emvField('54', valorFormatado);
  }

  // 58 - Country Code
  payload += emvField('58', 'BR');

  // 59 - Merchant Name
  payload += emvField('59', nomeFormatado);

  // 60 - Merchant City
  payload += emvField('60', cidadeFormatada);

  // 62 - Additional Data Field (transaction ID)
  const additionalData = emvField('05', txId);
  payload += emvField('62', additionalData);

  // 63 - CRC16 (checksum - MUST be the last field)
  payload += '6304';
  const checksum = crc16(payload);
  payload += checksum;

  return payload;
}
```

---

## Exemplo de Resultado Corrigido

**Antes (inválido):**
```
...62240520workflow-176998247116304EE6D
```

**Depois (válido):**
```
...62190515workflow17699826304XXXX
```

Onde:
- `62 19` = Campo 62 com 19 caracteres
- `05 15` = Subcampo 05 com 15 caracteres
- `workflow1769982` = txId sanitizado (sem hífens)
- `6304` + CRC recalculado

---

## Resumo das Alterações

| Arquivo | Modificação |
|---------|-------------|
| `src/utils/pixUtils.ts` | Adicionar função `sanitizeTxId()` e atualizar `normalizeText()` |

---

## Validação

Após a correção, o código PIX gerado deve:

1. Conter apenas caracteres alfanuméricos no campo txId
2. Ter comprimento máximo de 25 caracteres no txId
3. Ser aceito por qualquer aplicativo de banco brasileiro
4. Ter CRC válido para o payload correto

