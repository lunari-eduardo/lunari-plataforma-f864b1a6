# MODULE: decision

## O que é?
Decision Engine v1 (ADR-004). LÊ Intelligence + Context + Policy e **produz
propostas concretas** de ação (`capability_id + input + rationale`). Nunca
executa. Humano aciona via Hub; Automation (Onda 12) poderá acionar
autonomamente no futuro (ADR-006).

## O que Decision NÃO é
- Não executa capability → **Kernel** faz isso.
- Não interpreta dados crus → **Intelligence** interpreta.
- Não muda regras de negócio → **Policy** governa.
- Não aprende padrões → **Learning** (Onda 11).

## Escopo (v1)
Três proposers síncronos, um por `kind` de sinal:

| Sinal | Capability sugerida | Racional curto |
| --- | --- | --- |
| `session.health` (warn/crit) | `billing.chargeCreate` | Pagamento pendente, sessão próxima |
| `finance.anomaly.month` | `finance.reviewMonth` | Anomalia mensal detectada |
| `client.at_risk` | `tasks.create` | Cliente inativo com sessão futura |

## Capabilities
- `decision.list` (query) — lista propostas (ativas por padrão ou por status).
- `decision.propose` (command) — recomputa a partir da Intelligence. Idempotente
  por `(user_id, capability_id, source_kind, source_scope_key)`. Respeita
  propostas já `dismissed` (não ressuscita).
- `decision.dismiss` (command, approval) — usuário rejeita proposta.
- `decision.accept` (command, approval) — usuário aceita (execução real é
  responsabilidade do caller, via Kernel).

## Como responde aos 6 critérios do Guia do Produto
1. **Utilidade imediata**: Hub mostra "o que fazer agora" com input pronto.
2. **Simplicidade**: 1 tabela, 4 capabilities, 3 proposers puros.
3. **Velocidade**: leitura indexada por `(user_id, status, computed_at)`.
4. **Isolamento**: RLS owner-scope + CHECKs de domínio no banco.
5. **Reversibilidade**: propostas são derivadas; apagar não perde nada.
6. **Evolução**: novo sinal = novo proposer; contrato estável.

## Infra
- Tabela: `public.decision_proposals` (unique por `user_id+capability_id+source_kind+source_scope_key`,
  `rationale` ≤ 4KB, `input` ≤ 8KB, CHECKs de `status`/`severity`).
- Port: `src/shared/decision/DecisionStore`.

## Segurança
- RLS estrita: apenas o próprio `auth.uid()`.
- Sem GRANT para `anon`.
- `accept`/`dismiss` exigem aprovação humana quando chamados via canal IA.

## Fora de escopo v1
- Execução automática de propostas (isso é Automation — Onda 12).
- Proposers baseados em LLM.
- UI dedicada além de card mínimo no Hub.
- Aprendizado das rejeições (isso é Learning — Onda 11, ADR-005).

## Ondas seguintes
- **Onda 11 — Learning Engine v1**: detecta padrões nas rejeições/aceites →
  propõe patches em Context/Memory/Catalog. Nunca aplica.
- **Onda 12 — Automation Engine v1**: única engine autorizada a chamar
  `Kernel.execute` autonomamente sobre propostas aceitas.
