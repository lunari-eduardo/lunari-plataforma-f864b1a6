# ADR-001: Kernel único como fronteira pública de todo transporte

**Status:** Accepted — 2026-07-26

## Problema
Hoje o sistema tem múltiplos caminhos de execução: hooks React chamam `supabase.from` direto, edge functions replicam regras, `assistant/runtime/executeToolCall` implementa um path especial, MCP tem catálogo manual, webhooks pulam validação. Regras se duplicam, auditoria é incompleta, e adicionar uma nova interface (mobile, voz) exigiria reescrever regras.

## Alternativas consideradas
1. **Manter status quo** com "convenção" de sempre usar Capabilities — sem enforcement, dívida cresce.
2. **Kernel único obrigatório** com `execute / subscribe / list / describe` e lint bloqueando `supabase.from` fora de infra.
3. **Kernel por interface** (um para Web, um para Lu, um para MCP) — pior de todos: multiplica pontos de mudança.

## Decisão
Adotar **Kernel único** (`src/shared/capability/*`) como a única fronteira pública. Toda invocação de qualquer cliente (Web, Lu, MCP, API, Webhook, Automation, Mobile, Voice) passa por `Kernel.execute(capabilityId, input, actor)`. Actor tipado (`user | user-via-lu | user-via-mcp:<id> | automation:<id> | webhook:<src>`). Kernel orquestra: valida input → checa Policy → executa Domain handler → emite eventos → registra audit.

## Consequências (+)
- Um único ponto para auditoria, autorização, idempotência, versionamento.
- Novas interfaces são triviais (só implementam adaptador de transporte).
- MCP e Lu ficam descartáveis; arquitetura sobrevive à remoção deles.
- Testes cobrem uma superfície previsível.

## Consequências (–)
- Kernel vira ponto crítico; falha ali derruba tudo.
- Migração de código legado (`supabase.from` direto) é grande e progressiva.
- Curva de aprendizado para novos devs — precisa documentação clara.

## Impacto futuro
Kernel é considerado **contrato imutável**. Mudanças na assinatura de `execute` exigem ADR próprio. É a peça mais estável do sistema. Todo padrão futuro (streaming, batch, transações multi-capability) evolui **sobre** o Kernel, não paralelo a ele.
