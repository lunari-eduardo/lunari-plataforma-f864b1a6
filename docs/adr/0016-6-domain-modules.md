# ADR-016: 6 Domain modules substituem 12+ atuais

**Status:** Accepted — 2026-07-26

## Problema
Hoje temos 12+ módulos (`agenda`, `clientes`, `configuracoes`, `contratos`, `finance`, `formularios`, `gallery`, `leads`, `support`, `tasks`, `workflow`, `billing`, `assistant`). Fronteiras arbitrárias geram comunicação cruzada difícil (workflow ↔ finance ↔ gallery ↔ agenda).

## Alternativas consideradas
1. **Manter 12+ módulos** — perpetua comunicação cruzada.
2. **1 mega-módulo** — perde coesão local.
3. **6 domínios alinhados por processo de negócio**: Commerce, Production, Delivery, People, Money, Studio.

## Decisão
Consolidar em 6 domain modules:
- **Commerce** = leads, orçamentos, contratos, formulários de venda.
- **Production** = agenda, workflow, tasks, sessões.
- **Delivery** = gallery, entregáveis, selects, transfers.
- **People** = clientes, respondentes, colaboradores.
- **Money** = finance, billing, cobranças, planos.
- **Studio** = configurações, notificações, integrações, assistente config, support.

Consolidação via **estrangulamento** (ADR-017), consumer-a-consumer, ≤ 3 releases por domínio. Não é big-bang.

## Consequências (+)
- Fronteiras alinhadas a mental model do fotógrafo (Vender → Produzir → Entregar).
- Comunicação cross-módulo cai drasticamente.
- Onboarding de dev cai de "12 módulos" para "6 domínios".

## Consequências (–)
- Migração é trabalho contínuo por meses.
- Alguns arquivos vão trocar de lugar múltiplas vezes.

## Impacto futuro
Facilita ADR-002 (módulo = organização física): quando arquivos se moverem, arquitetura não muda.
