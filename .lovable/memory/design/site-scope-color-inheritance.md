---
name: Site institucional — herança de cor (.site-scope)
description: Headings do site ficavam quase invisíveis em produção porque o CSS global do app pinta h1-h6 com --foreground (tema dark). Regra .site-scope força color:inherit.
type: constraint
---

Causa raiz: `src/index.css` define `h1..h6 { color: hsl(var(--foreground)) }` para o app. Quando o usuário/SO está em dark mode, `.dark` entra no `<html>` e os títulos do site (fundo claro) ficam quase apagados. No preview do Lovable o tema estava light, por isso não aparecia.

Regra:
- `SiteLayout` aplica a classe `site-scope`; em `index.css` há bloco que força `color: inherit` para headings, p, li, span, a dentro de `.site-scope`.
- Em seções do site, sempre definir a cor explicitamente na seção (ex.: `style={{ background: SITE_LIGHT, color: SITE_DARK }}`) e nunca depender de tokens do app.
- Nunca numerar eyebrows das seções da Home ("01 •"). Usar apenas `• TÍTULO DA SEÇÃO`.
