# MODULE: observation

## O que é?
Sink passivo da Observation Engine v1 (ADR-012). Grava eventos de domínio
em `public.observation_events` (append-only, owner-scoped por RLS). Nunca
interpreta, agrega ou decide — isso é responsabilidade das Ondas seguintes
(Memory, Intelligence, Decision).

## Escopo (v1)
- Tabela `observation_events` append-only (sem UPDATE/DELETE policies).
- Sink `observationSink.record(...)` e binder para o Event Bus in-process.
- `observation.recent` (query) — leitura para debug/Hub/futuras engines.
- `observation.record` (command) — grava evento manual (útil para MCP/server).

Fora de escopo v1: agregação, scoring, TTL, alertas, retention automática,
eventos de UI (clicks/navegação).

## Como responde aos 6 critérios do Guia do Produto
1. **Utilidade imediata**: base observável do sistema — sem isso, Memory
   e Intelligence não têm de onde partir.
2. **Simplicidade**: 1 tabela, 1 sink, 2 capabilities. Zero UI obrigatória.
3. **Velocidade**: insert único indexado por (user_id, occurred_at).
4. **Isolamento**: RLS `user_id = auth.uid()`; sem UPDATE/DELETE.
5. **Reversibilidade**: append-only, mas admin pode truncar por usuário via SQL.
6. **Evolução**: contrato do sink é estável — trocar destino (S3, Datadog)
   = trocar 1 impl. Consumidores futuros (Memory) lêem via `observation.recent`.

## Segurança
- Nunca gravar segredos ou PII sensível no `payload` (contrato de payload
  fica com os emissores; a engine não filtra).
- RLS: `SELECT/INSERT` restritos ao próprio `user_id`.
- Sem `service_role` no cliente; edge functions podem usar service_role
  para agregações futuras.
