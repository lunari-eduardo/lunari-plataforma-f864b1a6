# Regras de Produto e Arquitetura das Galerias Lunari

> **Documento Vivo de Regras de Negócio e Contratos de Arquitetura**  
> Última atualização: 17 de Agosto de 2026

---

## 1. Identificadores e Resolução de Acesso (URL & Tokens)

### 1.1. Tipos de Identificadores Suportados
1. **Token Curto (`public_token`)**:
   - Código alfanumérico (ex: `noOeETu9lOiJ`, 12 caracteres nanoid).
   - Utilizado nos links oficiais para clientes: `https://app.lunarihub.com/l/:token` ou `/galeria/:token`.
2. **UUID (`id`)**:
   - Identificador primário da tabela `galerias` (UUID v4).
   - Utilizado em rotas administrativas, no Studio e em links legados: `/app/gallery/select/:id`.
3. **Aliases (`gallery_token_aliases`)**:
   - Histórico de tokens antigos caso o fotógrafo altere o link personalizado da galeria.

### 1.2. Regra de Resolução Híbrida em Edge Functions
Todas as Edge Functions públicas (`gallery-access`, `client-selection`, `confirm-selection`, `gallery-create-payment`) **DEVEM** implementar a resolução híbrida de galeria:
- Se o parâmetro recebido corresponder ao padrão Regex de UUID (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`), buscar por `id`.
- Caso contrário, buscar por `public_token`.
- Se não encontrar, verificar `gallery_token_aliases` (por `old_token`).
- **Nunca rejeitar ou dar 404 apenas porque o identificador é um UUID.**

---

## 2. Autenticação e Configuração de Edge Functions

### 2.1. Funções de Acesso Público do Cliente
As seguintes Edge Functions são consumidas diretamente pelo cliente final na galeria pública:
- `gallery-access`
- `client-selection`
- `confirm-selection`
- `gallery-create-payment`
- `gallery-visitors`

### 2.2. Regra de Ouro do JWT (`verify_jwt: false`)
- Todas as funções de galeria pública **DEVEM ser implantadas obrigatoriamente com `verify_jwt: false`** (`--no-verify-jwt`).
- O cliente acessa a galeria de forma anônima ou com JWT anônimo (`SUPABASE_ANON_KEY`).
- Se `verify_jwt: true` for configurado, o Supabase API Gateway bloqueia as requisições com `401 Unauthorized` antes mesmo do código da função executar.

---

## 3. Segurança e Controle de Acesso à Galeria

### 3.1. Galerias Privadas vs Públicas
- **Privada (`permissao === 'private'`)**:
  - Exige senha se `gallery_password` estiver preenchido.
  - No primeiro acesso sem senha, a função retorna status 200 com payload `{ requiresPassword: true }`.
  - Se a senha informada for incorreta, retorna status 401 com payload `{ code: 'WRONG_PASSWORD', error: 'Senha incorreta' }`.
  - Uma vez validada a senha na sessão do cliente (`sessionStorage`), as chamadas subsequentes enviam a senha para autorização.
- **Pública (`permissao === 'public'`)**:
  - Aberta para qualquer visitante.
  - Se configurada para identificação de visitantes, registra o visitante em `galeria_visitantes` e as seleções individuais em `visitante_selecoes`.

---

## 4. Modos de Venda e Provedores de Pagamento

### 4.1. Modos de Venda (`venda_fotos_extras`)
1. `no_sale`: Sem venda de fotos extras. O cliente seleciona apenas até o limite contratado (`qtd_fotos_inclusas`).
2. `sale_without_payment`: O cliente pode selecionar fotos extras, mas a galeria não realiza cobrança imediata; o fotógrafo acerta os valores por fora.
3. `sale_with_payment`: O cliente seleciona fotos extras e o sistema calcula o valor a cobrar, exigindo checkout imediato para finalizar a seleção.

### 4.2. Prioridade de Provedor de Pagamento
- Provedores suportados: `mercadopago`, `infinitepay`, `asaas`, `pix_manual`.
- **Regra de Prioridade Absoluta**: A configuração na galeria (`galerias.venda_pagamento_provedor`) **SEMPRE sobrepõe** a integração padrão do fotógrafo (`is_default` em `usuarios_integracoes`).
- Somente se a galeria estiver com `venda_pagamento_provedor` nulo/vazio é que a integração padrão da conta é usada como fallback.

### 4.3. Tipos de Checkout
- **Checkout Externo** (`mercadopago`, `infinitepay`): Redireciona o cliente para a URL externa de checkout com tela de overlay de transição no Lunari.
- **Checkout Transparente / Inline** (`asaas`): Abre modal ou formulário inline com dados de cartão/PIX/boleto dentro da própria galeria.
- **PIX Manual** (`pix_manual`): Exibe chave PIX cadastrada do fotógrafo, QR Code e botão de confirmação manual.

---

## 5. Ciclo de Vida da Seleção & Gating

### 5.1. Máquina de Estados de Seleção
- `em_andamento`: Cliente navegando e marcando/desmarcando fotos.
- `aguardando_pagamento`: Cliente confirmou seleção que possui valor a pagar. A seleção fica **travada** (`selectionLocked: true`), impedindo alterações de fotos até a quitação ou regeneração.
- `selecao_completa`: Seleção quitada ou finalizada sem saldo pendente. Galeria travada e fotógrafo notificado.
- `processando_selecao`: Estado transitório enquanto o webhook de pagamento ou rotina de reconciliação processa.

### 5.2. Idempotência e Regeneração (`regenerate_charge`)
- Quando o cliente retorna de um pagamento não concluído ou clica em "Ir para pagamento", a ação `regenerate_charge` revalida os extras, abate valores já pagos em cobranças anteriores e gera/retorna o checkout vivo atualizado.

---

## 6. Checklist de Auditoria para Mudanças em Galerias
Sempre que for alterar código relacionado a galerias:
1. [ ] A alteração quebra URLs com UUID ou URLs com `public_token`?
2. [ ] Todas as Edge Functions modificadas foram publicadas com `verify_jwt: false`?
3. [ ] O fluxo respeita a prioridade `galerias.venda_pagamento_provedor`?
4. [ ] Foram preservados os fallbacks para `visitorId` em galerias públicas?
5. [ ] O gating de travamento de seleção (`selectionLocked`) permanece íntegro?
