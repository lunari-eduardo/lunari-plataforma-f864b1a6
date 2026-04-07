
## Diagnóstico confirmado

- A rota pública **existe** em `src/App.tsx` (`/formulario/:token`). Então o problema não é “falta de rota”.
- O link do formulário está sendo montado com `window.location.origin` em `SendBriefingModal.tsx` e `ClienteFormulariosList.tsx`. Em preview/editor isso pode gerar **URL errada para compartilhamento**, levando o cliente para um host inadequado.
- O PWA ainda está configurado de forma arriscada para esse fluxo: `vite.config.ts` está com `devOptions.enabled: true`, e o cleanup atual do SW em `usePWAUpdate.ts` roda **tarde demais**.
- `FormularioPublico.tsx` usa o estado local `submitted` para o sucesso, mas ao recarregar/reabrir o link esse estado se perde. Hoje a página pública **não sabe persistentemente** que o formulário já foi respondido.
- O fluxo atual ainda permite inconsistência de múltiplas respostas: a UI do fotógrafo lê “a resposta mais recente”, sinal de que o sistema ainda não está travando **uma única submissão por formulário**.
- O blur do modal filho foi ajustado, mas o modal pai continua visualmente “ativo”. Em modal aninhado, não basta subir `z-index` do filho; o pai também precisa entrar em estado de fundo.

## Plano de correção

### 1. Corrigir a URL pública compartilhada
- Criar um utilitário central para links públicos, por exemplo `getPublicShareBaseUrl()`.
- Em preview/localhost/editor/iframe, esse utilitário deve usar o **domínio publicado/canônico** do app, nunca `window.location.origin`.
- Substituir a montagem manual de URL em:
  - `src/components/formularios/SendBriefingModal.tsx`
  - `src/components/formularios/ClienteFormulariosList.tsx`

### 2. Blindar preview + PWA para não interceptar rotas públicas
- Em `src/main.tsx`, antes de montar o React, desregistrar service workers e limpar caches quando:
  - estiver em preview (`id-preview--...`)
  - estiver dentro do editor/iframe
  - estiver em rota pública (`/formulario/*`, `/checkout/*`)
- Em `src/hooks/usePWAUpdate.ts`, manter o guard para não registrar SW nesses contextos.
- Em `vite.config.ts`, desligar PWA em dev/preview (`devOptions.enabled: false`) e manter a `navigateFallbackDenylist`.
- Não depender de ajuste em arquivo gerado (`dev-dist/sw.js`); a correção deve ficar só na origem do comportamento.

### 3. Tornar o link público estado-aware
- O carregamento público deve passar a distinguir:
  - disponível para responder
  - já respondido
  - expirado
  - inválido/indisponível
- `useFormularioPublico` deve considerar `status_envio`, `expires_at` e o estado real do formulário, não só `status = publicado`.
- `FormularioPublico.tsx` deixa de depender apenas do `submitted` local.

### 4. Impedir segunda resposta do mesmo formulário
- No banco, travar **uma única resposta por `formulario_id`** com abordagem segura:
  - constraint/índice único em `formulario_respostas(formulario_id)`
  - validação de inserção para barrar novo envio quando já houver resposta
- Fazer migration segura: se existir duplicidade histórica, preservar o histórico antes de impor a trava, sem apagar silenciosamente.

### 5. Permitir reabertura somente em modo visualização
- Após o envio:
  - cliente não pode mais editar nem reenviar
  - ao abrir o link novamente, vê apenas a resposta salva em modo leitura
  - fotógrafo continua vendo a mesma resposta no painel
- Para isso, criar uma leitura pública segura da resposta via `public_token` (RPC/view/função segura), sem afrouxar RLS da tabela inteira.
- Reaproveitar a mesma base visual de `FormularioRespostasView` para manter consistência entre cliente e fotógrafo.

### 6. Melhorar UX da página pública pós-resposta
- Adicionar estado visual claro:
  - “Questionário finalizado”
  - data/hora da resposta
  - dados do respondente, se houver
- Desabilitar completamente inputs, upload e botão de envio no modo finalizado.
- Tratar também o estado expirado com tela própria, sem permitir edição.

### 7. Corrigir o destaque do modal dentro do modal da agenda
- O filho já tem overlay próprio, mas o pai ainda não reage.
- Em `src/components/agenda/AppointmentDetails.tsx`, enquanto `sendBriefingOpen` estiver ativo:
  - aplicar leve blur/escurecimento/opacidade reduzida no conteúdo do modal pai
  - bloquear interação visual do pai
- Manter contraste mais forte no modal filho, mas a correção principal é o **pai entrar em estado de fundo**.

## Arquivos envolvidos

- `src/main.tsx`
- `src/hooks/usePWAUpdate.ts`
- `vite.config.ts`
- `src/utils/domainUtils.ts` ou novo utilitário de URL pública
- `src/components/formularios/SendBriefingModal.tsx`
- `src/components/formularios/ClienteFormulariosList.tsx`
- `src/hooks/useFormularios.ts`
- `src/pages/FormularioPublico.tsx`
- `src/components/formularios/FormularioRespostasView.tsx` ou renderer compartilhado
- `src/components/agenda/AppointmentDetails.tsx`
- migration SQL para resposta única + leitura pública segura

## QA que precisa ser feita após a correção

- Criar formulário pela agenda e pelo CRM
- Copiar link e validar que aponta para o domínio público correto
- Abrir o link direto em aba anônima/dispositivo sem login
- Responder uma vez, recarregar e confirmar modo somente leitura
- Tentar reenviar e validar bloqueio
- Testar preview/editor, reload, mobile e expirado sem cair na landing

## Resumo da causa raiz

O problema não é ausência de rota pública. É a combinação de:
1. geração do link com origem errada,
2. PWA/SW interferindo em preview e rotas públicas,
3. falta de persistência do estado “já respondido”,
4. ausência de trava robusta para resposta única.
