---
name: Design DNA SITE v1
description: Regras oficiais de design do site institucional (lunarihub.com) — ritmo escuro/claro, layout dividido alternado, vídeos só em heros, imagens editoriais, tipografia protagonista.
type: design
---

Fonte de verdade: `docs/constitution/DESIGN_DNA_SITE.md`. Aplica-se APENAS ao site institucional (rotas públicas em `SiteLayout`), não ao app.

Regras-núcleo:
- Cada seção = capítulo. Muito espaço negativo, poucos elementos, tipografia protagonista. Nunca landing SaaS nem catálogo de funcionalidades.
- Ritmo de fundos: escuro → claro → escuro → claro. Exceção narrativa: seções que formam o mesmo capítulo (Home 02 e 03) mantêm o fundo claro. Escuro `#0B0B0B`, claro `#F7F5F2`. Único acento = dourado fosco `#C9A87C` (`TOKENS.gold`). Terracota/ember PROIBIDO no site.
- Layout dividido em TODAS as seções. Desktop: 40–45% texto / 55–60% visual, alternando lado a cada seção (01 texto à esquerda, 02 visual à esquerda, 03 texto à esquerda...). Mobile sempre texto → visual.
- Vídeos só em heros: Home, Studio, Gallery Select, Gallery Transfer. Máximo 4 no site. Atmosfera premium (macro, foco lento, profundidade), nunca screenshot/tutorial.
- Imagens sempre editoriais fine art (papel, luz natural, materiais nobres). Proibido stock, pessoas com notebook, mockups genéricos.
- Títulos grandes, poucas palavras, sem blocos densos de texto.
- Proibidos: glassmorphism, gradientes exagerados, neon, cards decorativos, caixas de preenchimento, linhas conectoras, infográficos.
- Movimento: fade, translate suave, parallax pequeno. Nada de compreensão dependente de scroll.
- Regra de ouro: se o elemento não comunica uma ideia, ele não pertence ao site.
