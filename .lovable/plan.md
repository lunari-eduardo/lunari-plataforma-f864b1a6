

# Padronização Visual: Camadas, Regras de Hover e Arquivo de Regras

## Diagnóstico

### Problemas encontrados no CSS atual:

1. **`lunari-card:hover` em `index.css` (linha 318-321)** — aplica `translateY(-2px)` e muda shadow. Qualquer componente usando `.lunari-card` ganha lift no hover, podendo conflitar com cards que já controlam hover via Tailwind.

2. **Button variants `destructive` e `secondary`** — usam `hover:opacity-90` e `hover:opacity-80` respectivamente, reduzindo visibilidade no hover (padrão invertido).

3. **`glass:hover` (linha 297-299)** — muda apenas shadow sem aumentar contraste do fundo. Não é invertido, mas é incompleto.

4. **WorkflowCard hover** — usa `hover:bg-black/[0.02]` que sobrepõe o `bg-white/40` base. Visualmente o card fica *mais escuro* ao invés de *mais opaco/elevado*. Deveria aumentar a opacidade branca.

5. **Backgrounds** — já estão bons (InternalBackground com blobs terracota, DashboardBackground com 3D). O pedido é padronizar as 3 camadas para que novos componentes sigam o sistema.

## Plano

### 1. Criar `src/styles/lunari-design-rules.md` — Documentação de regras

Arquivo de referência com as regras de 3 camadas, regras de hover, e paleta. Serve como guia para desenvolvimento.

### 2. Corrigir `src/index.css` — Regras de hover

- **`.lunari-card:hover`** (linha 318-321): Aumentar opacidade do fundo ao invés de apenas translateY. Light: `rgba(255,255,255,0.75)`, Dark: `rgba(40,40,42,0.70)`. Manter lift e shadow.
- **`.glass:hover`** (linha 297-299): Adicionar fundo mais opaco além da shadow.

### 3. Corrigir `src/components/ui/button.tsx` — Hover de destructive e secondary

- `destructive`: `hover:opacity-90` → `hover:bg-destructive/90` (muda fundo, não opacidade global)
- `secondary`: `hover:opacity-80` → `hover:bg-secondary/80` (idem)

### 4. Corrigir `src/components/workflow/WorkflowCard.tsx` — Hover correto

- Collapsed hover: `hover:bg-black/[0.02]` → `hover:bg-white/55` (aumenta opacidade branca)
- Expanded hover: idem → `hover:bg-white/60`
- Dark: `hover:bg-white/[0.06]` e `hover:bg-white/[0.08]`

### 5. Adicionar classes utilitárias no `index.css`

```css
/* Lunari Panel — para dashboards, sem hover lift */
.lunari-panel { ... }

/* Lunari List Card — para workflow rows */  
.lunari-list-card { ... }
```

### Resumo de arquivos

```text
Arquivo                              Mudança
────────────────────────────────────  ──────────────────────────────
src/styles/lunari-design-rules.md    NOVO — regras de design
src/index.css                        Fix hover glass/lunari-card + novas classes
src/components/ui/button.tsx         Fix hover destructive/secondary
src/components/workflow/WorkflowCard.tsx  Fix hover opacidade
```

4 arquivos. Foco em eliminar padrões invertidos e criar guia de referência.

