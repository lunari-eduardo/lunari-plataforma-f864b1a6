

# Fix: Formulário público mostra Landing Page + Modal sem destaque

## Problema 1: Formulário redireciona para Landing Page

**Causa raiz**: O Service Worker (PWA) registra-se incondicionalmente via `usePWAUpdate()` no componente `App`. Quando um cliente anônimo abre `/formulario/:token`, o SW intercepta a navegação e pode servir uma versão cacheada antiga (antes do `navigateFallbackDenylist` existir). Mesmo com o denylist configurado no `vite.config.ts`, o SW antigo continua ativo no browser do usuário até ser substituído.

**Solução**: Adicionar guard no `usePWAUpdate.ts` para **não registrar o SW** quando a URL atual é uma rota pública (`/formulario/`, `/checkout/`). Isso garante que clientes anônimos nunca tenham o SW interferindo. Além disso, no `main.tsx`, desregistrar qualquer SW existente quando estiver em rota pública.

```ts
// usePWAUpdate.ts — guard no início
const isPublicRoute = /^\/(formulario|checkout)\//.test(window.location.pathname);
if (isPublicRoute) {
  // Desregistrar SW existente para não interferir
  navigator.serviceWorker?.getRegistrations().then(regs => 
    regs.forEach(r => r.unregister())
  );
  return;
}
```

## Problema 2: Modal de briefing não se destaca do modal de detalhes

**Causa raiz**: O overlay padrão do `DialogOverlay` já tem `bg-black/40 backdrop-blur-sm`. Quando o `SendBriefingModal` passa `overlayClassName="backdrop-blur-sm bg-black/40"`, está repetindo os mesmos valores — sem efeito visual adicional.

Para que o modal filho se destaque sobre o modal pai, o overlay do filho precisa de um z-index mais alto que o conteúdo do modal pai (`z-50`). O overlay padrão é `z-40`, então fica por baixo.

**Solução**: No `SendBriefingModal`, usar `overlayClassName="z-[60] backdrop-blur-md bg-black/60"` para:
- `z-[60]` — overlay acima do conteúdo do modal pai (z-50)
- `backdrop-blur-md` — desfoque mais forte que o padrão (`sm`)
- `bg-black/60` — fundo mais escuro para contraste

Também adicionar `className="z-[70]"` no `DialogContent` do `SendBriefingModal` para garantir que o conteúdo do modal filho fique acima do seu próprio overlay.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePWAUpdate.ts` | Guard para não registrar SW em rotas públicas |
| `src/components/formularios/SendBriefingModal.tsx` | z-index elevado + backdrop-blur-md no overlay |

