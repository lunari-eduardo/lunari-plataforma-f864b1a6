

# Otimizar Grid dos Cards para o Layout 70%

## Problema

O grid desktop dos cards usa `grid-cols-[36px_50px_180px_200px_150px_140px_90px_80px_90px_auto]` = ~1016px fixos + auto. Com o container limitado a ~70% da tela (~900-1000px úteis após padding e painel lateral), as últimas colunas (Pendente, Galerias) ficam cortadas.

## Solução

Reajustar as larguras das colunas do grid desktop para caber confortavelmente no espaço disponível, comprimindo colunas que têm espaço ocioso:

| Coluna | Atual | Novo | Motivo |
|--------|-------|------|--------|
| Expand | 36px | 32px | Ícone de 16px não precisa de 36px |
| Data | 50px | 46px | "02/03" cabe em 46px |
| Nome | 180px | 160px | Nomes truncam naturalmente |
| Descrição | 200px | 160px | Input já trunca, 160px suficiente |
| Pacote | 150px | 130px | Combobox compacto |
| Status | 140px | 120px | Badge cabe em menos |
| Fotos extras | 90px | 70px | Input de 56px + label |
| Produtos | 80px | 70px | Botão compacto |
| Pendente | 90px | 80px | "R$ 1640,00" cabe em 80px |
| Galerias | auto | auto | Mantém flex para botões |

**Total fixo: 1016px → 868px** — libera ~150px extras para a coluna Galerias.

## Mudanças

### `src/components/workflow/WorkflowCardCollapsed.tsx`
- Linha 310: Alterar grid-cols de `[36px_50px_180px_200px_150px_140px_90px_80px_90px_auto]` para `[32px_46px_160px_160px_130px_120px_70px_70px_80px_auto]`
- Reduzir `max-w-[200px]` da descrição para `max-w-[160px]`

### `src/components/workflow/WorkflowCardList.tsx`
- Remover `min-w-[1100px]` do wrapper dos cards no mobile (já existe `lg:min-w-0` mas o min-w mobile pode ser reduzido para `min-w-[900px]`)

