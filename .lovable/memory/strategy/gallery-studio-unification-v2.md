---
name: Estratégia oficial de unificação Gallery → Studio (v2)
description: Plano oficial de migração gradual (não big-bang). Gallery em modo manutenção durante beta. Workspaces no topo (Studio/Gallery). Referência mestre em docs/handoff/GALLERY_MERGE_PLAN.md
type: preference
---

**Plano oficial vigente:** `docs/handoff/GALLERY_MERGE_PLAN.md` (v2, 2026-07-22).
Substitui qualquer plano anterior de fusão imediata / "big bang".

## Regras que a IA DEVE seguir

1. **Sem fusão imediata.** Não iniciar unificação Gallery↔Studio até que os 3 critérios sejam atendidos: Studio estável + Gallery estável + beta validado.
2. **Gallery em modo manutenção:** só bugfix e ajustes críticos no projeto Gallery separado. Nenhuma feature nova relevante lá.
3. **Novo desenvolvimento** é pensado para a arquitetura unificada futura, mesmo quando entregue hoje no projeto atual.
4. **Feature flag obrigatória** para qualquer código de unificação (rollout: admin → primeiros usuários → beta → todos).
5. **Navegação futura = Workspaces no topo** (seletor Studio/Gallery), NÃO um item "Gallery" na sidebar.
6. **Fontes únicas de verdade** após unificação:
   - Clientes: CRM do Studio.
   - Financeiro (pagamentos/extras/cobranças/PIX/Asaas/MP/InfinitePay): módulos do Studio.
   - Configurações (meios de pagamento, integrações, branding, empresa): Studio.
7. **Domínios finais:** `app.lunarihub.com` (principal) + `gallery.lunarihub.com` mantido para cliente final (`/g/:token`) por SEO/links/branding — ambos apontando para o mesmo projeto.
8. **Identidade visual única** em Studio e Gallery-fotógrafo. Tema personalizado só no cliente final.
9. **Evitar alterações estruturais** compartilhadas enquanto os dois projetos coexistirem: contratos, auth, webhooks, tabelas, storage. Se inevitável, já modelar para a arquitetura unificada.
10. **Migração incremental.** Nunca troca em uma única virada. Rollback disponível em toda etapa.
