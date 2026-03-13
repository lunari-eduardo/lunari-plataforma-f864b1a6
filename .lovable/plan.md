

# Correções e Melhorias no Card do Workflow

## Problemas Identificados

### 1. Hover/foco laranja nos inputs (marcados em vermelho)
Os inputs de Desconto e Adicional no card expandido (linhas 282, 320 de `WorkflowCardExpanded.tsx`) usam `focus:bg-background` que causa um flash visual. O card inteiro também tem hover com translação (`hover:-translate-y-px`) que contribui para a sensação de lentidão.

### 2. Galeria duplicada no card expandido
O bloco 3 do card expandido (linhas 337-435) repete os botões "Criar Galeria" e "Ver" que já existem na row colapsada (Zona 10, linha 450 do `WorkflowCardCollapsed.tsx`). Remover do expandido conforme marcado com "X".

### 3. Inputs de Desconto/Adicional — foco deve selecionar tudo e permitir limpar o "0"
Ao clicar, o texto deve ser selecionado inteiramente (`onFocus → e.target.select()`), e o valor "R$ 0,00" não deve persistir — permitir campo vazio durante edição.

### 4. Botão "Gerenciar pagamentos" → renomear para "Pagamentos"
Linha 433 de `WorkflowCardExpanded.tsx`.

### 5. Adicionar botões "Cobrar" e "Agendar pagamento manual" no card expandido
Trazer os dois botões que existem no modal de `SessionPaymentsManager` (Cobrar → abre `ChargeModal`, Adicionar Pagamento → abre `PaymentConfigModalExpanded`) diretamente para o bloco 3 do card expandido, eliminando a necessidade de abrir o modal para ações rápidas.

## Alterações

### `src/components/workflow/WorkflowCardExpanded.tsx`

1. **Remover seção Galeria duplicada** (linhas 337-420): Eliminar os botões "Criar Galeria" e "Ver" do bloco 3 expandido. Manter apenas ações de pagamento.

2. **Reestruturar bloco 3** como "Ações de Pagamento":
   - Botão "Cobrar" (outline, ícone Send) → abre `ChargeModal`
   - Botão "Agendar pagamento manual" (primary, ícone Plus) → abre `PaymentConfigModalExpanded` diretamente
   - Botão "Pagamentos" (outline, ícone CreditCard) → abre modal completo (renomeado)

3. **Adicionar imports**: `ChargeModal`, `PaymentConfigModalExpanded`, `Send`

4. **Adicionar estados**: `showChargeModal`, `showAddPaymentModal`

5. **Inputs Desconto/Adicional** (linhas 277-284, 315-321):
   - Adicionar `onFocus={(e) => e.target.select()}` para selecionar todo o texto ao clicar
   - Remover `focus:bg-background` (causa o flash laranja visual)
   - Permitir valor vazio durante edição (já funciona pois usa `descontoValue` local)

### `src/components/workflow/WorkflowCard.tsx`

6. **Remover hover translate do card expandido** (linha 54): Remover `hover:-translate-y-px` do estado expandido para eliminar micro-animação desnecessária que causa sensação de lentidão.

6 pontos de alteração em 2 arquivos. Zero lógica de negócio alterada nos cálculos financeiros.

