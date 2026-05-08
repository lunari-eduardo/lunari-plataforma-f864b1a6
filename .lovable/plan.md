## Diagnóstico da causa raiz

A edição de **Qtd fotos extras** e **Vlr foto extra** no card expandido do Workflow (e CRM) não persiste porque existe uma trigger no banco que **força reescrita** dos valores sempre que a sessão está vinculada a uma galeria com vendas:

**Trigger `z_protect_session_extras_consistency`** (`protect_session_extras_consistency`):
```
IF galeria.valor_total_vendido > 0 AND galeria.total_fotos_extras_vendidas > 0 THEN
  NEW.qtd_fotos_extra        := v_gal_qtd
  NEW.valor_total_foto_extra := v_gal_total
  NEW.valor_foto_extra       := v_gal_total / v_gal_qtd
END IF
```

E a trigger `recalc_fotos_extras` faz coisa similar quando `qtd_fotos_extra = v_gal_qtd`.

Resultado: o frontend manda `UPDATE`, o banco aceita, mas a própria trigger BEFORE UPDATE sobrescreve os campos com os valores da galeria. Após o realtime devolver a linha, os valores antigos voltam (~1s depois) — exatamente o sintoma relatado.

Esse comportamento foi criado de propósito para evitar divergência sessão ↔ galeria, mas **bloqueia o caso legítimo** em que o fotógrafo precisa ajustar manualmente (vendas por fora, brindes, ajuste financeiro).

## Estratégia (mínima, sem quebrar lógica existente)

Introduzir um **flag explícito de override por sessão**. Quando o usuário edita manualmente os campos no Workflow/CRM, marcamos a sessão como "override" e a trigger respeita os valores manuais. Sincronização da galeria continua funcionando normalmente para todas as sessões não-override.

### 1. Banco (migration)

- Adicionar coluna `extras_overridden boolean NOT NULL DEFAULT false` em `clientes_sessoes`.
- Adicionar coluna `extras_overridden_at timestamptz` (auditoria).
- Atualizar `protect_session_extras_consistency`: se `NEW.extras_overridden = true`, `RETURN NEW` sem reescrever.
- Atualizar `recalculate_fotos_extras_total`: se `NEW.extras_overridden = true`, ignorar ramo da galeria e usar `qtd × valor_foto_extra` direto (mantém ramo padrão).
- A edge function `gallery-update-session-photos` deve **resetar** `extras_overridden = false` quando vier sincronização real do Gallery (cliente comprando), para não travar a sincronização futura.

### 2. Frontend — `useWorkflowRealtime.ts`

No `case 'qtdFotosExtra'` e `case 'valorFotoExtra'`:
- Setar `sanitizedUpdates.extras_overridden = true` e `extras_overridden_at = now()`.
- Manter o cálculo atual de `valor_total_foto_extra = qtd × valor_foto_extra` no próprio update (snapshot já existe).
- Não recalcular pelo `regras_congeladas` quando override ativo (já há ramo `isManualHistorical`, replicar lógica).

### 3. Frontend — `WorkflowCardExpanded.tsx`

- Quando `session.extras_overridden`, mostrar pequeno badge "Manual" ao lado do Lock (substituindo a mensagem "Sincronizado com galeria").
- Adicionar botão discreto "Re-sincronizar com galeria" (aparece só se `galeriaId && extras_overridden`) que faz update setando `extras_overridden = false` — trigger volta a aplicar valores da galeria automaticamente.
- Manter o `AlertDialog` de confirmação atual quando `galeriaHasSales` (já existe), apenas atualizando o texto: "Esta sessão tem galeria vinculada. Ao salvar, os valores não serão mais sincronizados automaticamente com o Gallery."

### 4. Tipos

- Atualizar `SessionData` (`src/types/workflow.ts`) com `extrasOverridden?: boolean`.
- Mapear em `useWorkflowPackageData.convertSessionToData`.
- `src/integrations/supabase/types.ts` é regenerado pela migration.

## Detalhes técnicos

**Triggers afetadas (BEFORE INSERT/UPDATE em clientes_sessoes):**
- `recalc_fotos_extras` — adicionar guard `IF NEW.extras_overridden THEN ramo padrão`.
- `z_protect_session_extras_consistency` — adicionar `IF NEW.extras_overridden THEN RETURN NEW`.
- `trigger_recalculate_valor_total` — não precisa mudar (já lê `valor_total_foto_extra` que persistirá correto).
- `sync_session_extra_price_to_frozen` — não precisa mudar (faz patch do JSON congelado, comportamento desejado).

**Edge function `gallery-update-session-photos`:**
- Adicionar `updateData.extras_overridden = false` quando vier um POST com `qtdFotosExtra/valorFotoExtra` definidos, para que sincronizações reais do Gallery (cliente fechando seleção) tenham prioridade e limpem o override.

**Backfill:** sessões existentes ficam com `extras_overridden = false` (default), comportamento atual preservado 100%.

**Multiusuário:** flag por linha, sem estado global; cada sessão decide independente. Sem complexidade adicional.

## Arquivos afetados

- `supabase/migrations/<timestamp>_extras_override.sql` (nova migration)
- `supabase/functions/gallery-update-session-photos/index.ts`
- `src/hooks/useWorkflowRealtime.ts`
- `src/components/workflow/WorkflowCardExpanded.tsx`
- `src/types/workflow.ts`
- `src/hooks/useWorkflowPackageData.ts`

## Verificação

1. Editar qtd/valor em sessão sem galeria → persiste (já funciona, comportamento mantido).
2. Editar em sessão com galeria sem vendas → persiste (já funciona).
3. Editar em sessão com galeria com vendas → confirma diálogo → persiste, badge "Manual" aparece.
4. Cliente seleciona fotos no Gallery → edge function reseta override → valores voltam a sincronizar.
5. Botão "Re-sincronizar com galeria" → limpa override → trigger reaplica valores da galeria.
