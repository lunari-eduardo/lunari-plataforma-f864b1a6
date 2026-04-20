

# Plano: Remover cores de categorias + edição inline reativa

## Diagnóstico

**Cor**: a coluna `cor` existe em `categorias` (DB) e é usada em ~12 componentes para "decorar" categorias (bolinha colorida em selects, barra lateral em cards de pacote, badge tonalizada). Funcionalmente, **não há lógica que dependa da cor** — é puramente visual.

**Edição inline já existe** (`Categorias.tsx` → `InlineEditCategoriaRow`): salva no Enter ou no blur, com update otimista via `useOptimisticConfiguration.update`. O state local muda imediatamente após o `await onUpdate(...)`. Porém, o que o usuário percebe como "precisa reload" é provavelmente **outra tela** (Pacotes, Workflow, Análise) ainda mostrando o nome antigo — porque:

1. **Pacotes** lê `categorias` via mesmo contexto (deveria atualizar) — verificado, funciona.
2. **Workflow / sessões** desnormalizam `categoria` (texto) em `clientes_sessoes` — propagação por trigger SQL já existe + `workflowCacheManager.clearAllCache()` já é chamado quando nome muda.
3. O caso real do bug pode ser: o input mantém o foco e o `onBlur` só dispara ao clicar fora, mas como a UI sai do modo edição **somente após** `await onUpdate` resolver, o usuário pode ter impressão de "travado" enquanto a request roda.

A solução é manter o fluxo otimista, mas garantir UX imediata: **trocar o estado de edição para fechar instantaneamente** (otimista) e deixar o erro reverter caso falhe.

## Mudanças

### 1. Remover suporte a cor em categorias (UI)

| Arquivo | Mudança |
|---|---|
| `src/components/configuracoes/Categorias.tsx` | Remover constante `COLOR_PALETTE`, remover bolinha colorida (`<div style={{ backgroundColor: categoria.cor }}>`), remover passagem de `cor` em `onAdd` (passar `cor: ''` ou string vazia para manter compat com type) |
| `src/components/configuracoes/Pacotes.tsx` | Remover bolinha colorida nos `SelectItem` do filtro de categoria |
| `src/components/configuracoes/PacoteCard.tsx` | Remover barra lateral colorida (linhas 43-49) e estilo inline da Badge (substituir por `variant="outline"` neutra) |
| `src/components/configuracoes/pricing/CategoryPricingConfig.tsx` | Remover bolinha colorida (linhas 35-38) e prop `categoriaCor` passada ao modal |
| `src/components/configuracoes/TabelaPrecosModal.tsx` | Remover prop `categoriaCor` e bolinha colorida do header (linhas 21-26, 194-197) |
| `src/components/ui/categoria-selector.tsx` | Remover bolinha colorida no `SelectItem` (linhas 39-42) |

### 2. Tornar a cor opcional no tipo (sem migration de DB)

| Arquivo | Mudança |
|---|---|
| `src/types/configuration.ts` | `cor?: string` em `Categoria`. Remover `cor` dos `DEFAULT_CATEGORIAS` (ou deixar vazio). |

**Não vamos rodar migration para dropar a coluna `cor`** — ela continua no banco como nullable, sem prejuízo. Reduz risco de quebrar integrações externas (Gallery, Edge Functions, etc.).

### 3. Limpar cores existentes no banco (1 migration)

`UPDATE public.categorias SET cor = NULL WHERE user_id = auth.uid()` — porém isso roda como service_role na migration, então faremos:

```sql
UPDATE public.categorias SET cor = NULL;
```

Limpa cores de **todos os usuários** (a cor não tem mais função). Operação reversível e segura (não destrói nada essencial).

### 4. Edição inline com fechamento imediato (otimista)

Em `Categorias.tsx` → `InlineEditCategoriaRow.save()`:

**Antes** (sequencial — fecha só após await):
```ts
await onUpdate(categoria.id, { nome: trimmed });
setIsEditing(false);
```

**Depois** (otimista — fecha imediatamente, reverte se falhar):
```ts
setIsEditing(false);          // UX: fecha já
setError('');
try {
  await onUpdate(categoria.id, { nome: trimmed });
} catch {
  setIsEditing(true);          // reabre se erro
  setError('Erro ao salvar');
}
```

Como `useOptimisticConfiguration.update` já atualiza `state.data` antes do `await persistFn()`, o nome novo aparece imediatamente em **toda** a UI que consome o contexto (Pacotes select, badges, etc.) — sem reload.

### 5. Garantir que `adicionarCategoria` não envie `cor` obrigatória

Em `Categorias.tsx`:
```ts
onAdd({ nome: novaCategoria.trim() } as any);
```

Se `cor` ainda for obrigatória em algum lugar do pipeline (Supabase aceita NULL — coluna nullable), passar `cor: null` ou omitir.

## Anti-bugs

1. **DB schema**: `categorias.cor` precisa ser NULL-safe. Se hoje for `NOT NULL`, a migration vai (a) `ALTER COLUMN cor DROP NOT NULL`, (b) `UPDATE` para NULL.
2. **Outros consumidores de `cor`**: o componente `GerenciarCategorias` em `financas/` usa `CategoriaFinanceira` (tipo diferente, tabela diferente) — **não tocar**, escopo separado.
3. **Adapters**: `SupabaseConfigurationAdapter*` ainda inserem `cor: categoria.cor` — passará `null` ou `undefined`, sem erro porque coluna ficará nullable.
4. **Workflow/sessões**: nome de categoria desnormalizado em `clientes_sessoes` continua sendo propagado pelo trigger SQL existente (sem mudança).
5. **Realtime**: o canal de `categorias` continua publicando UPDATE quando nome muda; outros usuários veem em tempo real.

## Resultado esperado

- Tela Configurações → Categorias: lista limpa, sem bolinhas/cores. Adicionar nova categoria pede só nome. Editar inline (clique no nome → digita → Enter ou blur) atualiza em < 100ms na UI, mesmo enquanto a request ao Supabase termina ao fundo. Em caso de erro, volta ao modo edição com mensagem.
- Tela Pacotes / Cards / Workflow / Modal de preços: aparência neutra, sem cores associadas a categoria — apenas o nome.
- Banco de dados: coluna `cor` zerada para todos; permanece como coluna nullable para compatibilidade.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/...` (nova) | `ALTER TABLE categorias ALTER COLUMN cor DROP NOT NULL; UPDATE categorias SET cor = NULL;` |
| `src/types/configuration.ts` | `cor?: string \| null` em `Categoria` |
| `src/components/configuracoes/Categorias.tsx` | Remove paleta, bolinha, e fecha edição imediatamente (otimista) |
| `src/components/configuracoes/Pacotes.tsx` | Remove bolinha do filtro de categoria |
| `src/components/configuracoes/PacoteCard.tsx` | Remove barra lateral e estilos coloridos da Badge |
| `src/components/configuracoes/pricing/CategoryPricingConfig.tsx` | Remove bolinha e prop `categoriaCor` |
| `src/components/configuracoes/TabelaPrecosModal.tsx` | Remove prop `categoriaCor` e bolinha do header |
| `src/components/ui/categoria-selector.tsx` | Remove bolinha do `SelectItem` |

