
# Plano: assinatura digital sem fricção + PDF limpo

## Problemas identificados

1. **Fotógrafo sem botão "Assinar" claro.** Hoje o botão só aparece quando o e-mail do `profile` bate exatamente com o e-mail do signatário no Autentique. Se houver divergência (case, espaço, e-mail diferente do cadastrado), o fotógrafo só vê o ícone de "reenviar" — que é o botão errado.
2. **Reenvio por e-mail falhando** ("Edge Function returned a non-2xx status code"). A mutation `resendSignatures` da Autentique exige plano pago em algumas contas e o fluxo é confuso — o usuário não quer esperar e-mail chegar, ele quer **abrir o link e assinar agora**.
3. **Fluxo trava após cliente assinar.** Cliente assina → status fica "Aguardando" para o fotógrafo → fotógrafo não tem como assinar pela UI → contrato nunca conclui. O cron de 5 min só ajuda *depois* que ambos assinarem.
4. **PDF tem linhas para assinatura manual** (`_______ CONTRATANTE / CONTRATADA(O)`), redundantes num fluxo 100% digital. A própria Autentique adiciona página de manifesto com as assinaturas eletrônicas no final.

## Solução proposta

### 1. UI — substituir "reenviar e-mail" por "abrir link de assinatura"

No `ContratoViewerModal.tsx`, no bloco de signatários (linhas ~279-347):

- **Remover** o botão de reenviar e-mail (`MailPlus`) e a mutation `resendSigner` da UI (manter no hook por enquanto, sem exposição).
- **Para qualquer signatário pendente/visualizado que tenha `s.link`**, mostrar botão primário **"Abrir link de assinatura"** (`ExternalLink`) que abre `s.link` em nova aba.
  - Se for o fotógrafo (match por e-mail), o rótulo vira **"Assinar agora"** com ícone `FileSignature` e estilo destacado.
  - Se for o cliente, rótulo **"Abrir link"** — útil pra reenviar manualmente por WhatsApp ou copiar a URL.
- **Adicionar botão secundário "Copiar link"** (ícone `Copy`) em cada signatário pendente, copia `s.link` pro clipboard com toast de erro só se falhar.
- **Tornar o match do fotógrafo mais tolerante**: comparar e-mails normalizados (`trim().toLowerCase()`) e, se o `profile.email` não bater, usar fallback comparando com `claims.email` enviado pelo `auth.user`.

### 2. Banner de ação rápida quando o fotógrafo precisa assinar

Acima da lista de signatários, quando `jaEnviadoNaAutentique && !isAssinado` e existir um signatário-fotógrafo pendente, mostrar uma faixa destacada:

```
┌──────────────────────────────────────────────────────┐
│ ✍  Sua assinatura está pendente                       │
│   [Assinar agora →]   [Copiar link]                   │
└──────────────────────────────────────────────────────┘
```

Isso resolve o "fluxo travado": fotógrafo abre o contrato, vê o CTA, clica e assina na Autentique. Ao voltar, clica em **"Atualizar status"** (botão já existente) ou aguarda o cron de 5 min — o PDF assinado é baixado automaticamente.

### 3. PDF — remover bloco de assinaturas manuais

Em `src/utils/contratoPdf.ts`:

- **Versão HTML (html2pdf)**: remover o `<table class="contrato-pdf-assinaturas">` (linhas ~275-286) e o CSS associado (linhas ~192-196). Manter apenas o `contrato-pdf-fechamento` (cidade + data) e o footer.
- **Versão jsPDF (fallback)**: remover o bloco de assinaturas (linhas ~417-430) — as duas linhas horizontais e os labels CONTRATANTE/CONTRATADA(O).
- **Adicionar nota discreta no rodapé**: "As assinaturas eletrônicas constam no manifesto anexado pela plataforma de assinatura digital." (só quando o contrato for enviado pra assinatura — opcionalmente sempre, já que o PDF não-assinado também é só rascunho).

### 4. Limpeza menor

- Remover `resendSigner` / `isResendingSigner` da desestruturação no modal (continua exportado pelo hook caso precise no futuro).
- Não removo a edge function `autentique-resend-signer` (mantém por compatibilidade, mas deixa de ser chamada).

## Arquivos afetados

- `src/components/contratos/ContratoViewerModal.tsx` — novo CTA, banner do fotógrafo, copiar link, match tolerante.
- `src/utils/contratoPdf.ts` — remover bloco de assinaturas em ambas versões (HTML e jsPDF).

## Fora do escopo

- Não mexo em edge functions (envio, sync, cron continuam como estão).
- Não mexo no schema do banco.
- Não removo o cron — ele continua sendo a rede de segurança que baixa o PDF assinado.

## Resultado esperado

- Cliente assina pelo e-mail → fotógrafo abre o modal do contrato no Lunari → vê banner "Sua assinatura está pendente" → clica **Assinar agora** → assina no Autentique → volta e clica **Atualizar status** (ou aguarda 5 min) → PDF assinado disponível pra download, status "Assinado".
- PDF gerado sem linhas de assinatura manual — visual mais limpo e coerente com o fluxo digital.
