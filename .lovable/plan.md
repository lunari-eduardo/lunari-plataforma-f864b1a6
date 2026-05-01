# Diagnóstico do fluxo atual

Inspecionei o contrato real (`890909de9df8e61c23dd12eeca694846de700d640ac348912`) no banco e a Autentique:

```
Cliente   eduardo22diehl@gmail.com   → assinado    (01/05 12:10)
Fotógrafo lisediehlfotos@gmail.com   → visualizado (01/05 12:10)
Status do contrato                    → enviado    ✅ correto
```

O fluxo está **funcionando do lado do retorno** — o sync da Autentique trouxe os signers atualizados, status individual correto, timestamps OK. O problema está em **3 pontos da experiência**:

## Problemas reais encontrados

### 1. Fotógrafo não recebe e-mail da Autentique

A Autentique **não envia e-mail para o dono da conta da API** (o próprio fotógrafo) — assume que ele assina pelo painel dela. Isso explica o "fotógrafo nunca recebe email". Não é bug do nosso lado, é comportamento da plataforma.
**Solução**: enviar nós mesmos um e-mail transacional (Resend) para o fotógrafo com o link `signers[].link` quando ele for incluído como signatário, e ao detectar (no sync) que o cliente assinou e o fotógrafo ainda não.

### 2. Botão "Assinar" do fotógrafo só aparece dentro do modal

Hoje, na lista (`ClienteContratosList`) e no card de sessão, o fotógrafo só vê "Editar". Para chegar ao botão "Assinar agora" precisa abrir o modal e rolar até o bloco da Autentique. Pior: se o `profile.email` estiver vazio ou divergente, nem dentro do modal aparece.
**Solução**: 

- Mostrar botão **"Assinar"** destacado direto na lista de contratos quando houver `signers` com o e-mail do fotógrafo pendente.
- Tornar o match mais robusto: comparar contra `profile.email`, `user.email` (auth) **e** o `signers[].email` que tenha `papel === 'SIGN'` e não seja o e-mail do cliente — assim mesmo sem perfil completo, o botão aparece.

### 3. "PDF baixado em branco"

A lógica de download atual: se `arquivo_assinado_path` existe, baixa do storage; senão, gera o PDF do conteúdo HTML via html2pdf. No estado atual (apenas cliente assinou), `arquivo_assinado_path` é `null`, então cai no gerador. Se o usuário relata "em branco", é porque pdf estava sem as assinaturas do autentique, não sem conteúdo.  
**Solução**: 

- Auditar `contratoPdf.ts` após a última edição — verificar se a remoção do bloco `.contrato-pdf-assinaturas` deixou algum `<table>` órfão, vírgula no template literal ou referência CSS quebrada. (não necessário)
- Adicionar guard: se o PDF gerado tiver `< 5KB`, considerar falha e disparar fallback jsPDF imediatamente.
- **Adicional UX**: enquanto o contrato está "enviado" (parcialmente assinado), o botão deve dizer **"Baixar rascunho"** e exibir tooltip "PDF assinado fica disponível após todas as assinaturas" — assim o usuário não confunde o rascunho com o documento final.

### 4. Confusão "lista mostra Enviado, card do cliente mostra Assinado"

Não é divergência real — ambos leem `contrato.status`. O badge verde "Assinado" no print é o badge **do signer cliente** (linha individual), não o status do contrato. Mas a UI causa confusão porque o badge do signer usa exatamente as mesmas cores do status global.
**Solução**: diferenciar visualmente os badges dos signers (usar ícone menor e fundo mais sutil, ou prefixar com "Cliente:" / "Fotógrafo:") e adicionar um sub-status no header do modal explicando "1 de 2 assinaturas concluídas".

---

# Plano de implementação

## A. Notificar fotógrafo por e-mail (Resend)

**Nova edge function `autentique-notify-signer**` (ou reutilizar Resend já existente):

- Aceita `{ contrato_id, signer_email, link, tipo: 'envio' | 'lembrete' }`.
- Envia e-mail HTML simples: "Você tem um contrato para assinar — [Assinar agora]".
- Validação de JWT, rate limit por contrato (máx 3 lembretes/dia).

**Trigger automático no `autentique-send-contrato**`:

- Após criar documento, se `includeFotografoAsSigner=true`, dispara o e-mail para o fotógrafo com o `signers[].link` correspondente. Não bloqueia a resposta (fire-and-forget com `EdgeRuntime.waitUntil`).

**Trigger automático no cron sync**:

- Quando detectar que o cliente assinou mas o fotógrafo ainda está pendente há mais de 1h, dispara um lembrete (uma vez só, marcado em `dados_extras` do contrato).

**Botão manual no modal**: "Reenviar e-mail para mim" usando essa mesma função (substitui o reenvio Autentique que falha).

## B. Botão "Assinar" no nível da lista

Em `ClienteContratosList.tsx` (e `SessaoContratoButton`), para cada contrato com `status === 'enviado'`:

- Calcular `fotografoPendente` (mesma lógica do modal, com match robusto).
- Se existir, renderizar botão primário **"Assinar"** (ícone `FileSignature`, cor âmbar/destaque) ao lado do "Editar". Clique abre `signers[].link` em nova aba.
- Se não existir mas o cliente também não assinou, mostrar badge "Aguardando cliente".

**Match robusto** (utility `getFotografoSigner`):

1. Tenta match por `profile.email` (normalizado).
2. Fallback: `user.email` do AuthContext.
3. Último fallback: signer cujo e-mail **não** é o `cliente.email` e tem `papel === 'SIGN'` (assume que o outro signer é o fotógrafo).

## D. UX dos status (modal e lista)

No `ContratoViewerModal`:

- Adicionar abaixo do título uma linha tipo: **"Aguardando 1 de 2 assinaturas"** (ou "Todas as partes assinaram") calculada a partir de `signers`.
- Mudar label do botão "Baixar PDF" para **"Baixar rascunho (PDF não assinado)"** quando `!arquivo_assinado_path`, e **"Baixar PDF assinado"** quando existir.
- Suavizar visual dos badges individuais dos signers (já estão em badge outline pequeno — está OK, manter; só adicionar prefixo "Cliente"/"Você" mais explícito no nome).

## E. Secrets necessários

Verificar `RESEND_API_KEY` (provavelmente já existe pelas funções Asaas/MercadoPago — se não, solicitar). Domínio remetente: usar o domínio já verificado do projeto ou `onboarding@resend.dev` como fallback de teste.

---

# Arquivos afetados

- **Nova**: `supabase/functions/autentique-notify-signer/index.ts`
- `supabase/functions/autentique-send-contrato/index.ts` — disparar e-mail ao fotógrafo após criar doc.
- `supabase/functions/autentique-cron-sync/index.ts` — disparar lembrete quando cliente assinou e fotógrafo está pendente.
- `src/utils/contratoPdf.ts` — guard de blob vazio + fallback automático + revisão pós-remoção de assinaturas.
- `src/components/contratos/ClienteContratosList.tsx` — botão "Assinar" inline.
- `src/components/contratos/SessaoContratoButton.tsx` — idem para sessões.
- `src/components/contratos/ContratoViewerModal.tsx` — match robusto, sub-status "X de Y assinaturas", label dinâmico do botão de download, botão "Reenviar e-mail para mim".
- `src/hooks/useContratos.ts` — adicionar `notifySigner` mutation.

# Fora de escopo

- Não mexo no schema do banco (signers já em JSON, suficiente).
- Não removo o cron de 5 min (rede de segurança).
- Não troco a Autentique nem implemento webhook deles (centralização via cron já decidida).

# Resultado esperado

1. Fotógrafo recebe e-mail próprio do Lunari assim que o contrato é enviado, com link direto para assinar.
2. Na lista de contratos, vê botão **"Assinar"** destacado sem precisar abrir modal.
3. Após cliente assinar, recebe lembrete automático em ~1h se ainda não tiver assinado.
4. "Baixar PDF" deixa claro se é rascunho ou versão assinada — e nunca devolve PDF em branco (fallback garantido).
5. Status visual no modal mostra explicitamente "Aguardando 1 de 2 assinaturas", eliminando confusão.