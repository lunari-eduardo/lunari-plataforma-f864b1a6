# MODULE: intelligence

## O que é?
Intelligence Engine v1 (ADR-004). LÊ Observation/Context/Memory/Knowledge e
**produz significado** (sinais interpretados). Não decide ação. Decision
Engine (Onda 10) consumirá esses sinais.

## O que Intelligence NÃO é
- Não decide ação → **Decision**.
- Não aplica mudança de negócio → **Automation**.
- Não é fonte da verdade → todos sinais são derivados e reconstruíveis.
- Não usa LLM em v1. Heurística pura, testável, offline.

## Escopo (v1)
Três analyzers síncronos, sem cron. Recomputação sob demanda via capability.

- `session.health` — sessão a sessão: pagamento pendente + proximidade da data.
- `finance.anomaly.month` — desvio > 40% da receita/despesa vs média dos 3 meses anteriores.
- `client.at_risk` — cliente com sessão futura E sem interação há > 60 dias.

## Capabilities
- `intelligence.list` (query) — lista sinais ativos (default) ou todos.
- `intelligence.refresh` (command) — recomputa um `kind`. Idempotente por
  `(user_id, kind, scope_key)`. Sem aprovação humana.

## Como responde aos 6 critérios do Guia do Produto
1. **Utilidade imediata**: Hub e Lu ganham inputs interpretados prontos.
2. **Simplicidade**: 1 tabela, 2 capabilities, 3 analyzers puros.
3. **Velocidade**: leitura direta indexada por `(user_id, kind, computed_at)`.
4. **Isolamento**: RLS owner-scope + CHECKs de domínio no banco.
5. **Reversibilidade**: sinais são derivados → apagar não perde nada.
6. **Evolução**: novos `kind` = novo analyzer + atualizar CHECK; contrato estável.

## Infra
- Tabela: `public.intelligence_signals` (unique por `user_id+kind+scope_key`,
  `reasons` ≤ 4KB, CHECKs em `kind`/`severity`).
- Port: `src/shared/intelligence/IntelligenceStore`.

## Segurança
- RLS estrita: apenas o próprio `auth.uid()`.
- Sem GRANT para `anon`.
- CHECKs no banco garantem domínio válido.

## Fora de escopo v1
- Worker cron / TTL automático (`expires_at` existe, execução fica para v2).
- Sinais baseados em LLM.
- UI dedicada além de card mínimo no Hub.
- Sinais cross-tenant.

## Ondas seguintes
- **Onda 10 — Decision Engine v1**: consome `intelligence.list` + Context +
  Policy → produz propostas (`Capability + input + rationale`); nunca executa.
- **Onda 11 — Learning Engine v1**: detecta padrões em Observation → propõe
  patches em Context/Memory/Catalog. Nunca aplica (ADR-005).
- **Onda 12 — Automation Engine v1**: única engine autorizada a chamar
  `Kernel.execute` autonomamente (ADR-006).
