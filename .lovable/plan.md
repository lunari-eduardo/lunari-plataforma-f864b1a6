## Problema identificado

Ao editar **Qtd fotos extras** ou **Vlr foto extra** no card expandido do Workflow, o campo **Total fotos extras** permanece R$ 0,00 até um refresh manual. Consequentemente, o `Total` da sessão também não reflete as fotos vendidas por fora.

### Causa raiz (investigação completa)

1. **Banco de dados já calcula corretamente**. A trigger `recalc_fotos_extras` em `clientes_sessoes` faz `valor_total_foto_extra := qtd_fotos_extra × valor_foto_extra`, e `trigger_recalculate_valor_total` recompõe o `valor_total`. Testado e consistente.

2. **Frontend NÃO reflete o recálculo imediatamente**. No fluxo atual:
   - `WorkflowCardExpanded` chama `onFieldUpdate(sessionId, 'qtdFotosExtra' | 'valorFotoExtra', ...)` direto (linhas 234/261).
   - `Workflow.tsx > handleFieldUpdate` (linha 237–287) aplica um **optimistic merge** no cache apenas com o campo editado (`qtd_fotos_extra` OU `valor_foto_extra`), **sem recalcular localmente `valor_total_foto_extra` nem `valor_total`**.
   - O valor correto só chega de volta via realtime do Supabase (após o trigger). Se a subscription atrasar ou não reemitir o registro completo, a UI segue mostrando R$ 0,00.

3. **Lógica de recálculo existente está órfã**. `WorkflowTable.handleEditFinish` (linhas 587–623) até recalcula `valorTotalFotoExtra` manualmente após edição, mas essa função **só é disparada pelo layout tabular antigo**, não pelo card expandido (o layout principal hoje).

4. **`AutoPhotoCalculator` é importado mas nunca renderizado** em `WorkflowTable.tsx` (linha 26 importa, JSX nunca instancia) — portanto não atua.

5. Não há bloqueio da trigger `z_protect_session_extras_consistency` no caso da imagem (galeria sem vendas registradas). O problema é puramente de reatividade de UI.

### Resultado visível
Cliente com `valor_foto_extra=R$ 25,00`, `qtd=3`, galeria vazia → BD grava `valor_total_foto_extra=75,00`, mas a UI segue exibindo `R$ 0,00` até recarregar.

---

## Objetivo da correção

1. Ao alterar **Qtd fotos extras** ou **Vlr foto extra** no card, o total deve recalcular **instantaneamente** (optimistic), e o `Total` da sessão deve ajustar no mesmo frame.
2. Permitir registro manual de fotos extras vendidas por fora da galeria, com cálculo automático e confiável (já é permitido hoje, mas a UI não reflete).
3. Respeitar regras congeladas e desconto progressivo quando existirem; senão aplicar `qtd × valor_unitário`.
4. Preservar o contrato atual com Galeria: se a galeria tem vendas registradas (`v_gal_total > 0` e `qtd sessão = qtd galeria`), a trigger do BD continua mandando — a UI apenas espelha.

---

## Plano de implementação

### 1. Recálculo otimista centralizado em `Workflow.tsx > handleFieldUpdate`

Quando `field` for `qtdFotosExtra` ou `valorFotoExtra`:

- Calcular `novoTotalFotoExtra` localmente usando `PricingFreezingService.calcularValorFotoExtraComRegrasCongeladas` se `regras_congeladas.pacote` existir; caso contrário `qtd × valor_foto_extra`.
- Se a sessão tiver `galeria_id` e a galeria tiver vendas consolidadas iguais à qtd → não sobrescrever (respeitar BD).
- Adicionar ao `cacheSafeUpdates`:
  - `valor_total_foto_extra` recalculado,
  - `valor_foto_extra` efetivo (quando houver desconto progressivo),
  - `valor_total` recomposto via fórmula idêntica ao trigger: `max(0, valor_base_pacote + valor_total_foto_extra + produtos_manuais + valor_adicional − desconto)`.
- Só então chamar `mergeUpdate(...)` e `updateSessionRealtime(sessionId, validUpdates)`.

Isso elimina a dependência do realtime para que a UI fique correta e mantém o BD como fonte da verdade (realtime continua conciliando depois).

### 2. Limpeza do código órfão

- Remover a duplicação `handleEditFinish` (linhas 586–622 de `WorkflowTable.tsx`) e import não usado `AutoPhotoCalculator` (linha 26). A lógica passa a viver em um único lugar (`handleFieldUpdate`).

### 3. Ajuste do `WorkflowCardExpanded`

- Sem mudança de comportamento do usuário.
- Pequena melhoria UX: habilitar edição do campo **Qtd fotos extras** mesmo em sessões vinculadas a galeria (já permite via `pendingExtraEdit`), e deixar explícito no tooltip que "editar sobrescreve a quantidade vinda do Gallery e recalcula o total automaticamente".
- Garantir `min=0` e normalização para inteiro (já existe).

### 4. Helper reutilizável

Criar `src/utils/fotosExtrasCalculator.ts` com uma função pura:
```ts
recalcFotosExtras({ qtd, valorFotoExtra, regrasCongeladas, galeriaInfo }) 
  => { valorUnitarioEfetivo, valorTotalFotoExtra, respeitarBanco }
```
Usada tanto por `handleFieldUpdate` (Workflow) quanto por `calculateTotal` (WorkflowTable) para garantir paridade de cálculo entre otimista e exibição.

### 5. Teste manual (checklist)

- Sessão sem galeria, sem regras congeladas: alterar qtd de 0→3 com valor=25 → total deve ir para R$ 75,00 imediatamente; Total da sessão sobe R$ 75,00.
- Alterar valor unitário 25→30 → total vai para R$ 90,00 sem piscar.
- Sessão com regras congeladas (desconto progressivo): qtd que aciona faixa menor aplica preço efetivo correto.
- Sessão com galeria que tem vendas (qtd bate): edição bloqueada pela trigger (UI respeita BD e mostra valores da galeria).
- Sessão com galeria sem vendas ainda: edição manual funciona (caso da imagem).

---

## Arquivos a alterar

- `src/pages/Workflow.tsx` — incrementar `handleFieldUpdate` com recálculo otimista.
- `src/utils/fotosExtrasCalculator.ts` — novo helper puro.
- `src/components/workflow/WorkflowTable.tsx` — remover código órfão (handleEditFinish antigo de fotos extras, import não usado) e usar o helper.
- `src/components/workflow/WorkflowCardExpanded.tsx` — tooltip mais claro; nenhuma mudança estrutural.

Sem migrações de banco — as triggers existentes já fazem o trabalho correto.