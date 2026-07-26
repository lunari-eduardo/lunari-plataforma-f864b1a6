# ADR-002: Módulos como organização física; arquitetura descrita por Capabilities/Engines

**Status:** Accepted — 2026-07-26

## Problema
A estrutura `src/modules/<x>/{domain,application,ports,infrastructure,presentation,ai,server,docs,tests}` virou modelo mental principal. Isso leva devs a pensarem "onde no módulo isso vai?" em vez de "que Capability isso é?". Também gera 12+ módulos com fronteiras arbitrárias e comunicação cruzada difícil.

## Alternativas consideradas
1. **Manter módulos como modelo mental** — perpetua confusão sobre onde vive lógica transversal (ex.: pagamento que envolve finance + workflow + gallery).
2. **Módulos = organização física apenas**, arquitetura descrita por Capabilities + Engines.
3. **Abandonar módulos** — perde-se coesão local; PRs viram diff-hell.

## Decisão
Módulos continuam existindo como **organização física do código**, mas **não** representam a arquitetura. A arquitetura é descrita por: Capabilities (o que o sistema faz), Entities (o que existe), Events (o que muda), Policies (o que é permitido), Engines (como o sistema pensa), Ports (com o que o sistema conversa).

## Consequências (+)
- Devs pensam "que Capability?" antes de "que módulo?".
- Refatoração de módulos vira operação mecânica, sem impacto arquitetural.
- Lógica transversal deixa de ser problema — ela vive na Capability, o módulo é só onde o arquivo mora.

## Consequências (–)
- Documentação precisa ser explícita sobre essa distinção.
- Onboarding precisa ensinar o modelo Capability-first antes de mostrar `src/modules/`.

## Impacto futuro
Consolidação futura de 12 → 6 domain modules (ADR-016) fica trivial, porque é só mover arquivos — a arquitetura não muda. Novos módulos podem nascer só como pastas, sem cerimônia.
