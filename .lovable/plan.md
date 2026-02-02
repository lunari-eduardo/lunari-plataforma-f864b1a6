

# Plano: Aprimorar Dropdown de Nichos do Onboarding

## Problema Atual

Analisando a imagem e o código do `NichoCombobox.tsx`:

1. **Lista desatualizada** - Apenas 9 nichos genéricos
2. **Dropdown cortado** - `max-h-60` (240px) com scrollbar nativa feia
3. **Scroll pobre** - Usa `overflow-y-auto` simples, sem experiência premium
4. **Posicionamento** - `absolute` com `left-1/2 -translate-x-1/2` pode causar cortes
5. **Falta feedback visual** - Hover/selected sem transições suaves

---

## Nova Lista de Nichos (15 itens)

| Ordem | Nicho |
|-------|-------|
| 1 | Newborn |
| 2 | Gestantes |
| 3 | Familia e Infantil |
| 4 | Eventos Sociais |
| 5 | Pre-wedding |
| 6 | Casamentos |
| 7 | Boudoir |
| 8 | Pets |
| 9 | Produtos |
| 10 | Moda |
| 11 | Retrato Corporativo |
| 12 | Branding Pessoal |
| 13 | Eventos Corporativos e Palestras |
| 14 | Publicidade |
| 15 | Esportes |

---

## Melhorias para Sensacao Premium

### 1. Scroll com ScrollArea do Radix
Substituir `overflow-y-auto` por `ScrollArea` do Radix UI que ja existe no projeto:
- Scrollbar elegante e discreta
- Suporte touch nativo
- Animacoes suaves

### 2. Altura Dinamica do Dropdown
- Mostrar mais itens (max-h-[320px] ao inves de max-h-60)
- Altura calculada para ~7-8 itens visiveis

### 3. Efeitos Visuais Premium
- Transicoes suaves nos hovers (`transition-colors duration-150`)
- Fundo sutil no item selecionado com borda esquerda accent
- Sombra mais pronunciada no dropdown (`shadow-xl`)
- Bordas arredondadas maiores (`rounded-xl`)

### 4. Posicionamento Relativo
Mudar de `absolute z-50 w-full max-w-md left-1/2 -translate-x-1/2` para posicionamento relativo ao container pai, evitando cortes.

### 5. Backdrop Blur
Adicionar `backdrop-blur-sm` no dropdown para efeito glass sutil.

---

## Arquivo a Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/onboarding/NichoCombobox.tsx` | Atualizar lista e estilizacao |

---

## Codigo - Principais Mudancas

### Nova Constante de Nichos

```typescript
const NICHOS = [
  'Newborn',
  'Gestantes',
  'Familia e Infantil',
  'Eventos Sociais',
  'Pre-wedding',
  'Casamentos',
  'Boudoir',
  'Pets',
  'Produtos',
  'Moda',
  'Retrato Corporativo',
  'Branding Pessoal',
  'Eventos Corporativos e Palestras',
  'Publicidade',
  'Esportes'
] as const;
```

### Dropdown Estilizado

```tsx
{isOpen && (
  <div className="relative mt-2 bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl shadow-xl overflow-hidden">
    <ScrollArea className="max-h-[320px]">
      <div className="py-1">
        {filteredNichos.map((nicho) => (
          <button
            key={nicho}
            type="button"
            onClick={() => handleSelect(nicho)}
            className={cn(
              "w-full px-4 py-3 text-left text-sm flex items-center justify-between",
              "transition-all duration-150 ease-out",
              "hover:bg-[#CD7F5E]/10",
              value === nicho 
                ? "bg-[#CD7F5E]/15 text-[#CD7F5E] font-medium border-l-2 border-[#CD7F5E]" 
                : "text-gray-700"
            )}
          >
            <span>{nicho}</span>
            {value === nicho && <Check className="w-4 h-4 text-[#CD7F5E]" />}
          </button>
        ))}
      </div>
    </ScrollArea>
  </div>
)}
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 9 nichos genericos | 15 nichos especificos de fotografia |
| Scrollbar nativa feia | Scrollbar premium do Radix |
| max-h-60 (mostra ~3-4 itens) | max-h-[320px] (mostra ~7 itens) |
| Sem transicoes | Transicoes suaves em hover/select |
| Dropdown pode ser cortado | Posicionamento relativo ao input |
| Visual flat | Glass effect com backdrop-blur |

