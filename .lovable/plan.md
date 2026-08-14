# Chat da Lu — causa raiz encontrada e plano de correção

Não é o plano gratuito do Google. Os logs da edge function mostram turnos completos hoje
(`✓ Turno concluído — reason=tool-calls tokens=84332`), ou seja: a chave funciona, o modelo
responde e pede tools. O problema está **depois** — na execução das tools no navegador.

## Causa raiz #1 (bloqueante) — nenhuma tool consegue ser executada

`src/modules/ai-registry.ts` devolve um **Map**:

```ts
export function lunariAIToolMap(...) { const map = new Map(...); ... return map; }
```

mas `src/modules/assistant/runtime/executeToolCall.ts` acessa como objeto:

```ts
const map = getAllLunariAIToolsMap({ user });
const tool = map[toolName];      // sempre undefined em um Map
```

Resultado: **toda** chamada de tool devolve "Tool desconhecida ou indisponível", o modelo
tenta de novo, e o loop `stepCountIs(50)` gira até travar — exatamente o
`agenda__appointments__list · Running` da sua tela.

Prova independente: a tabela `assistant_invocations` não tem **nenhuma** linha desde
`2026-07-30`, embora hoje o modelo tenha emitido dezenas de tool-calls. Ou seja, o executor
nunca chega a rodar uma capability.

## Causa raiz #2 — voz manda o áudio inteiro como texto

No composer de voz, o WAV é convertido em `data:audio/wav;base64,...` e enviado como
**mensagem de texto**. Isso explica o balão gigante de base64 no seu print e os
~84k tokens por turno. Existe uma edge function `assistant-transcribe` pronta, hoje sem uso.

## Causa raiz #3 — auditoria cega

O `logInvocation` novo do `assistant-chat` insere em `assistant_invocations` e falha em
silêncio (nenhuma linha `assistant.chat.turn` foi gravada). Sem isso, todo diagnóstico
depende de logs voláteis.

---

## Correções

### Onda 1 — Executor de tools (corrige o chat)
- `executeToolCall.ts`: usar `map.get(toolName)` (ou converter o registry para objeto),
  com fallback tolerante a nomes com `__`.
- `AssistantChat.tsx`: se o resultado voltar `error`/`denied`, cortar o reenvio automático
  para não entrar em loop de 50 passos.
- Reduzir `stopWhen` de 50 para 8 passos por turno — chat operacional não precisa de 50.

### Onda 2 — Voz de verdade
- Enviar o áudio para `assistant-transcribe` e inserir o **texto transcrito** no composer
  (usuário confirma antes de enviar). Nunca mandar base64 como mensagem.
- Bloquear no envio qualquer conteúdo que comece com `data:` para evitar regressão.

### Onda 3 — Observabilidade
- Corrigir a gravação de `assistant.chat.turn` em `assistant_invocations` (alinhar colunas /
  permissões) e logar o erro do insert em vez de engolir.
- Registrar no console do cliente o resultado de cada tool call (id, status, latência).

### Onda 4 — Verificação
- Teste real no app: "quanto faturei esse mês?" deve executar `finance.*` e responder.
- Conferir em `assistant_invocations` uma linha `ok` por tool e uma por turno.

## Detalhes técnicos
Arquivos tocados: `src/modules/assistant/runtime/executeToolCall.ts`,
`src/modules/assistant/ui/AssistantChat.tsx`,
`supabase/functions/assistant-chat/index.ts`. Sem mudança de schema.
