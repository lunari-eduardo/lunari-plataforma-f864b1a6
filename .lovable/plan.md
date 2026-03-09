

# Fix: Dropdowns transparentes no modal de agendamento

## Causa raiz

A variável `--popover` foi alterada para `30 30% 98% / 0.42` (com canal alpha). As classes `.dropdown-solid` e `.dropdown-solid-item` no `index.css` usam `hsl(var(--popover))`, que agora resulta em fundo translúcido em vez de sólido.

Os componentes `ClientSearchCombobox` e `PackageSearchCombobox` usam essas classes para seus menus dropdown.

## Correção

### `src/index.css`

Atualizar as classes `dropdown-solid` para usar cores sólidas sem alpha:

```css
.dropdown-solid {
  background-color: hsl(30 30% 98%) !important; /* valor fixo sem alpha */
  backdrop-filter: blur(0px);
}
.dropdown-solid-item {
  background-color: hsl(30 30% 98%) !important;
}
.dropdown-solid-item:hover {
  background-color: hsl(30 15% 90%) !important; /* --muted sem alpha */
}
.dropdown-solid-header {
  background-color: hsl(30 15% 90%) !important;
}
```

E adicionar variantes dark correspondentes:
```css
.dark .dropdown-solid {
  background-color: hsl(20 12% 10%) !important;
}
.dark .dropdown-solid-item {
  background-color: hsl(20 12% 10%) !important;
}
.dark .dropdown-solid-item:hover {
  background-color: hsl(20 10% 15%) !important;
}
.dark .dropdown-solid-header {
  background-color: hsl(20 10% 15%) !important;
}
```

Isso garante que os dropdowns dentro de modais tenham fundo 100% opaco, independente das variáveis translúcidas do tema glassmorphism.

