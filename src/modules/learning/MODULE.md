# Módulo Learning — Learning Engine v1 (Onda 11 / ADR-005)

## Propósito
Detectar padrões nas decisões do usuário (aceitas vs rejeitadas) e propor
patches para Memory (preferências) ou "mute" de fontes de sinal com baixa
aceitação. Nunca aplica automaticamente: patches exigem aprovação humana.

## Fluxo
```
decision_proposals (accepted/dismissed, últimos 90 dias)
   ↓ agregar por (capability_id, source_kind)
learning_patterns (accepted, dismissed, sample_size, acceptance_rate, signal_strength)
   ↓ heurística
learning_patches (memory.remember | memory.forget | decision.mute_source)
   ↓ humano confirma
Memory.set  |  Pattern.status = muted
```

## Capabilities
- `learning.patterns.list` — leitura de padrões.
- `learning.recompute` — reagrega decisions → patterns → patches. Idempotente.
- `learning.patches.list` — lista patches abertos/aplicados/rejeitados.
- `learning.patches.apply` — aplica (exige aprovação humana).
- `learning.patches.dismiss` — rejeita (exige aprovação humana).

## Regras invioláveis
- Learning nunca escreve em Memory sem passar por `learning.patches.apply`.
- Patterns são idempotentes por `(user_id, capability_id, source_kind)`.
- Patches idempotentes por `(user_id, pattern_id, patch_kind, target)`.
- Aplicação de patch `decision.mute_source` apenas marca `pattern.status = muted`;
  Decision consulta `status` no futuro para não ressuscitar fontes silenciadas.
- Payload de patch limitado a 8KB.
- Amostra mínima: 5 decisões para gerar patch. Limiares: ≥0.8 favor / ≤0.2 mute.

## Não faz
- Não executa nenhuma ação sem confirmação humana.
- Não retreina modelos, não é ML — heurística pura sobre agregados SQL.
- Não guarda histórico de conversas nem eventos brutos (isso é Observation).
