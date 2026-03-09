

# Correção do Editor de Templates de Formulários

## Problemas Identificados

1. **Categorias hardcoded** — O select de categoria usa `CATEGORIA_LABELS` fixo. Deve usar as categorias salvas pelo usuário na tabela `categorias`.
2. **Campo "Data" mostra placeholder desnecessário** — Campos do tipo `data` não precisam de input de placeholder (é um date picker).
3. **Dropdown "Adicionar campo" não funciona** — O `DropdownMenu` dentro de `Dialog > ScrollArea` tem problema de portal/z-index. Precisa de ajuste.
4. **Templates do sistema com dados incompletos** — Os exemplos do Casamento não incluem endereço da cerimônia/festa conforme solicitado.

## Alterações

### 1. `FormularioTemplateEditor.tsx` — Categorias dinâmicas + fixes

- Importar `useRealtimeConfiguration` para obter categorias do usuário
- Substituir o `Select` de categorias hardcoded por categorias dinâmicas da tabela `categorias`
- Mudar o tipo de `categoria` no template de enum fixo para `string` (nome da categoria do usuário)
- Para campos tipo `data`, `upload_imagem`, `upload_referencia`, `selecao_cores`: ocultar o input de placeholder (não faz sentido)
- Corrigir o `DropdownMenu` adicionando `modal={false}` no Dialog para permitir interação com menus dentro dele, ou usar `portal` adequado

### 2. `src/types/formulario.ts` — Flexibilizar categoria

- Mudar tipo `categoria` de union literal para `string` (aceitar qualquer nome de categoria do usuário)
- Remover `CATEGORIA_LABELS` hardcoded (será dinâmico)

### 3. Migration SQL — Atualizar templates de seed

Atualizar o template de Casamento para incluir os campos solicitados:
- Endereço da cerimônia
- Endereço da festa

E ajustar templates Gestante e Newborn conforme exemplos fornecidos.

### 4. `FormulariosConfig.tsx` — Ajustar exibição de categoria

- Usar o nome da categoria direto (string) em vez de `CATEGORIA_LABELS[...]`

## Detalhes Técnicos

**Categorias dinâmicas:**
```tsx
const { categorias } = useRealtimeConfiguration();
// No Select:
{categorias.map((cat) => (
  <SelectItem key={cat.id} value={cat.nome}>{cat.nome}</SelectItem>
))}
```

**Ocultar placeholder para tipos especiais:**
```tsx
{!['data', 'upload_imagem', 'upload_referencia', 'selecao_cores'].includes(campo.tipo) && (
  <div className="space-y-1.5">
    <Label>Placeholder</Label>
    <Input ... />
  </div>
)}
```

**Fix do Dropdown dentro do Dialog:**
Adicionar `modal={false}` no `DropdownMenu` para evitar conflito de foco com o Dialog.

