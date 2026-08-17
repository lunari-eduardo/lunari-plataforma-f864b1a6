# Regras de Produto e Arquitetura das Galerias Lunari

> **Documento Vivo de Regras de Negócio e Contratos de Arquitetura**  
> Última atualização: 17 de Agosto de 2026 (Atualizado: Regra de Bypass de Coleta de Dados / CRM Payer Hints)

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

## 5. Dados do Pagador (Payer Hints) e Bypass da Tela de Contato

### 5.1. Origem dos Dados (CRM do Fotógrafo)
- Quando a galeria está associada a um cliente (`galerias.cliente_id` ou via sessão `galerias.session_id` -> `clientes_sessoes.cliente_id`), o `gallery-access` deve buscar automaticamente os dados cadastrais do cliente em `clientes` (`nome`, `email`, `telefone`, `whatsapp`, `cpf_cnpj`).
- Caso seja galeria pública com identificação de visitante, utiliza os dados já preenchidos em `galeria_visitantes`.

### 5.2. Regra de Exibição da Tela "Dados de Cobrança" (`PreCheckoutContactStep`)
- **Se todos os dados exigidos pelo provedor já existirem no CRM e forem válidos**: A tela intermediária de "Dados de cobrança" **NUNCA DEVE APARECER**. O sistema deve avançar diretamente para o checkout (Mercado Pago, InfinitePay ou Asaas) com os dados pré-preenchidos.
- **Se faltar algum dado obrigatório** (ex: CPF ausente para Asaas/InfinitePay ou email para Mercado Pago): A tela `PreCheckoutContactStep` é aberta apenas com os campos faltantes destacados, já trazendo os demais campos pré-preenchidos.

---

## 6. Ciclo de Vida da Seleção & Gating

### 6.1. Máquina de Estados de Seleção
- `em_andamento`: Cliente navegando e marcando/desmarcando fotos.
- `aguardando_pagamento`: Cliente confirmou seleção que possui valor a pagar. A seleção fica **travada** (`selectionLocked: true`), impedindo alterações de fotos até a quitação ou regeneração.
- `selecao_completa`: Seleção quitada ou finalizada sem saldo pendente. Galeria travada e fotógrafo notificado.
- `processando_selecao`: Estado transitório enquanto o webhook de pagamento ou rotina de reconciliação processa.

### 6.2. Idempotência e Regeneração (`regenerate_charge`)
- Quando o cliente retorna de um pagamento não concluído ou clica em "Ir para pagamento", a ação `regenerate_charge` revalida os extras, abate valores já pagos em cobranças anteriores e gera/retorna o checkout vivo atualizado.

---

---

## 7. Congelamento de Regras de Precificação e Extras (Snapshot Imutável)

### 7.1. Princípio do Congelamento de Preço (Snapshot)
- Uma sessão e uma galeria devem manter os preços e descontos contratados na data da criação, independentemente de futuras alterações globais ou tabelas de preços que o fotógrafo venha a mudar no estúdio.
- O campo `regras_congeladas` (JSONB) em `clientes_sessoes` e `galerias` armazena a fotografia completa das regras no instante do congelamento.

### 7.2. Hierarquia e Resolução de Preço de Fotos Extras
Ao criar uma sessão (via Agenda, Workflow ou importação) ou uma galeria:
1. **Verificação do Modelo Ativo (`modelo_de_preco.modelo`)**:
   - `categoria`: Consulta a tabela associada à categoria do pacote em `tabelas_precos`.
     - Se configurada com `usar_valor_fixo_pacote = true`: utiliza o valor unitário fixo definido no pacote.
     - Se `usar_valor_fixo_pacote = false`: embute a `tabelaCategoria` com suas faixas de desconto progressivo (`faixas: [{ min, max, valor }]`).
   - `global`: Consulta a tabela global em `tabelas_precos`.
     - Se `usar_valor_fixo_pacote = true`: utiliza o valor fixo do pacote.
     - Se `usar_valor_fixo_pacote = false`: embute a `tabelaGlobal` com suas faixas progressivas.
   - `fixo`: Embute `precificacaoFotoExtra: { modelo: 'fixo', valorFixo: pacote.valor_foto_extra }`.
2. **Cálculo do `valor_foto_extra` Base**:
   - O campo numérico `valor_foto_extra` na sessão e na galeria deve refletir o valor unitário da **1ª foto extra** segundo as faixas do snapshot (calculado pela função SQL canônica `_extra_unit_price_for_quantity(regras_congeladas, valor_fixo, 1)`).

### 7.3. Fluxo de Herança: Agenda → Sessão no Workflow → Galeria
1. Ao salvar um agendamento na Agenda, o trigger `trg_ensure_workflow_session_on_confirm` cria a linha em `clientes_sessoes`.
2. O trigger `trg_ensure_regras_congeladas_on_insert` monta o snapshot `regras_congeladas` respeitando o modelo ativo (`categoria`/`global`/`fixo`).
3. Ao criar a galeria de seleção no Studio a partir dessa sessão, a galeria **herda integralmente** o snapshot `regras_congeladas` da sessão, preservando as faixas progressivas ativas.
4. **Sincronização Imediata no Frontend**:
   - Mutations da Agenda (`useCreateAppointmentMutation`, `useUpdateAppointmentMutation`, etc.) emitem o evento de domínio `workflow-cache-silent-refresh` com `{ force: true }`.
   - O `WorkflowCacheContext` captura o evento e revalida imediatamente a lista de sessões do mês em background, garantindo que o Workflow exiba a nova sessão instantaneamente ao navegar entre telas, sem necessidade de reload (F5).

---

## 8. Checklist de Auditoria para Mudanças em Galerias
Sempre que for alterar código relacionado a galerias:
1. [ ] A alteração quebra URLs com UUID ou URLs com `public_token`?
2. [ ] Todas as Edge Functions modificadas foram publicadas com `verify_jwt: false`?
3. [ ] O fluxo respeita a prioridade `galerias.venda_pagamento_provedor`?
4. [ ] O cliente com cadastro completo no CRM é redirecionado diretamente ao pagamento sem tela intermediária?
5. [ ] Foram preservados os fallbacks para `visitorId` em galerias públicas?
6. [ ] O gating de travamento de seleção (`selectionLocked`) permanece íntegro?
7. [ ] O snapshot de `regras_congeladas` respeita a tabela de categoria/global ativa do fotógrafo?
8. [ ] A criação de agendamento na Agenda reflete imediatamente no Workflow sem necessidade de F5?

