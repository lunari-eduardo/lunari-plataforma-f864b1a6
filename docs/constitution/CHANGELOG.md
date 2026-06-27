# Changelog — Constituição Lunari

## v1.0 — 2026-06-27
Documento fundador. Quatro arquivos oficiais:
- `CONSTITUTION.md` — 20 princípios permanentes (Art. 6 estendido: Assistente também não pode chamar Edge Functions fora do manifesto; Art. 10 inclui idempotência e side-effects declarados).
- `ARCHITECTURE.md` — estrutura oficial por módulo (`domain/application/ports/infrastructure/presentation/ai/server/docs/tests`), padrão `src/modules/`, TanStack Query + Zustand + realtime como invalidador.
- `PRODUCT_GUIDE.md` — visão, missão, fluxo oficial Lead→Pós-venda, 6 perguntas obrigatórias por feature. Nota sobre Orçamento/Contrato ainda não modularizados.
- `ASSISTANT_GUIDE.md` — nome "Lu" provisório, auditoria obrigatória de invocações da IA, orçamento de execução por turno.

Reorganização de arquivos:
- `docs/ARCHITECTURE.md` → `docs/ARCHITECTURE_TECHNICAL.md` (complementar, detalha implementação de Capability/Ports).
