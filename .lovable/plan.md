
# Plano: recuperar fotos extras + desconto progressivo nas sessões com crédito

## Diagnóstico (validado no banco)

Cruzei `clientes_sessoes`, `galerias`, `audit_log` e `clientes_transacoes`. As **14 sessões com crédito** se dividem em **2 grupos bem distintos**:

### 🟢 Grupo A — 10 sessões com recuperação 100% automática (R$ 1.222,00)

A galeria perdeu os contadores (`total_fotos_extras_vendidas = 0`), mas o `audit_log.metadata` da última `confirm_selection` preserva **exatamente** quantidade, valor unitário (já com desconto progressivo) e total. **A matemática fecha perfeitamente** em todos os 10 casos: `valor_pago - valor_base_pacote - audit_total = R$ 0,00`.

| Sessão | Pacote | Qtd extras (audit) | Unit (audit) | Total extras | Crédito atual → após fix |
|---|---|---|---|---|---|
| Catiele Vargas 17/04 | Mães 26 10 fotos | 10 | R$ 25 | R$ 250 | R$ 250 → **R$ 0** |
| Jamile Deliberal 16/04 | Mães/26 5 fotos | 8 | R$ 25 | R$ 200 | R$ 200 → **R$ 0** |
| Alexia 26/03 | Páscoa 26 | 3 | R$ 25 | R$ 75 | R$ 75 → **R$ 0** |
| Catiele Vargas 20/03 | Mensal 25 | 5 | **R$ 23** ⚡ | R$ 115 | R$ 115 → **R$ 0** |
| Thais Freitas 19/03 | Mensal 25 | 13 | **R$ 21** ⚡ | R$ 273 | R$ 273 → **R$ 0** |
| Daniela Lopes 19/03 | Mensal 25 | 2 | R$ 25 | R$ 50 | R$ 50 → **R$ 0** |
| Paula Kelling 16/03 | Smash 10f | 2 | R$ 25 | R$ 50 | R$ 50 → **R$ 0** |
| Louise-Lorena 14/03 | Mensal 25 | 4 | **R$ 23** ⚡ | R$ 92 | R$ 92 → **R$ 0** |
| Jessica Garcia 14/03 | Gest. Estúdio 20f | 1 | R$ 25 | R$ 25 | R$ 25 → **R$ 0** |
| Roberta Tomaz 07/03 | Gest. Ext.+Estúd. 40f | 4 | **R$ 23** ⚡ | R$ 92 | R$ 92 → **R$ 0** |

⚡ **= Desconto progressivo recuperado** (Mensal faixa 4-7=R$23, faixa 8+=R$21; Gestantes faixa 4-7=R$23). Esses 4 casos vão mostrar o badge 🏷️ **% Desconto progressivo aplicado** que já implementamos.

### 🟡 Grupo B — 4 sessões que precisam de decisão humana (R$ 685,00)

São casos onde **não dá para inferir automaticamente** o que aconteceu:

| Sessão | Crédito | Por quê precisa decisão |
|---|---|---|
| **Gabriela 18/03** (Newborn 10f) | R$ 420 | Audit confirma 10 extras × R$ 21 = R$ 210, mas o cliente pagou R$ 1.120 no total. Sobra R$ 320 — pode ser impressão extra, álbum, próxima sessão, ou erro |
| **Juliana Dottes 26/04** (Mães 26 5 fotos) | R$ 25 | Sem galeria, sem audit. Pagamento de R$ 255 em 21/04 — pode ser cliente pagou R$ 25 a mais por engano, ou é uma foto extra avulsa |
| **Thaina Andrade 24/04** (Mensal 25) | R$ 10 | Sem galeria, 2 pagamentos manuais (R$80 + R$60 = R$140). Pode ser troco, gorjeta ou erro de R$ 10 |
| **Eduarda Goulart 15/01** (Mensal 25) | R$ 25 | Já tem `qtd_fotos_extra=3` (R$75), mas pagou R$25 a mais. Pode ser 4ª foto não cadastrada ou erro |

---

## Proposta de correção

### Fase 1 — Backfill automático seguro (Grupo A)

Migration única com backup + UPDATE baseado no `audit_log`:

```sql
-- Backup
CREATE TABLE backup_recovery_extras_audit_20260424 AS
SELECT cs.*, g.total_fotos_extras_vendidas AS bk_gal_qtd, g.valor_total_vendido AS bk_gal_total
FROM clientes_sessoes cs LEFT JOIN galerias g ON g.id = cs.galeria_id
WHERE cs.id IN ('47f1b390-...', '05ccd679-...', ...); -- 10 IDs

-- Recuperação via audit_log (snapshot da última confirm_selection)
WITH ultima_selecao AS (
  SELECT DISTINCT ON (gallery_id)
    gallery_id,
    (metadata->>'extrasACobrar')::int AS qtd,
    (metadata->>'valorUnitario')::numeric AS unit_efetivo,
    (metadata->>'valorTotal')::numeric AS total
  FROM audit_log
  WHERE action='confirm_selection' 
    AND (metadata->>'paymentRequired')::boolean = true
  ORDER BY gallery_id, created_at DESC
)
-- 1. Restaurar contadores na galeria
UPDATE galerias g SET
  total_fotos_extras_vendidas = us.qtd,
  valor_total_vendido = us.total,
  valor_foto_extra = us.unit_efetivo
FROM ultima_selecao us
WHERE g.id = us.gallery_id 
  AND g.id IN (...10 ids...);

-- 2. O trigger sync_gallery_extras_to_session (já corrigido na migration anterior)
--    propaga automaticamente para clientes_sessoes com:
--      - qtd_fotos_extra = us.qtd
--      - valor_foto_extra = us.unit_efetivo (preço com desconto progressivo)
--      - valor_total_foto_extra = us.total
--      - regras_congeladas.pacote.valorFotoExtraEfetivo = us.unit_efetivo
--    E o trigger trigger_recalculate_valor_total recalcula valor_total
```

**Resultado**: 10 sessões saem com crédito = R$ 0, fotos extras visíveis no UI, badge de desconto progressivo onde aplicável.

### Fase 2 — Modal de reconciliação manual (Grupo B)

Criar componente `ReconcileExtrasModal.tsx` acionado por botão **"Reconciliar crédito"** que aparece **apenas quando `valor_pago > valor_total + 0.01`**, posicionado próximo ao badge "+R$ XX,00" amarelo no card colapsado.

**Layout do modal:**

```
┌─────────────────────────────────────────────────┐
│  Reconciliar crédito de R$ 420,00               │
│  Gabriela - Otávio E Olívia · 18/03             │
├─────────────────────────────────────────────────┤
│  💡 Sugestão automática (do audit_log)          │
│  Foram cobradas 10 fotos extras a R$ 21,00 cada │
│  com desconto progressivo (faixa 8+).           │
│  Total: R$ 210,00                               │
│  [Aplicar sugestão]                             │
│                                                 │
│  ── ou ajustar manualmente ──                   │
│                                                 │
│  Quantidade de fotos extras:  [  10  ]          │
│  Valor unitário efetivo:      [R$ 21,00]        │
│  Total cobrado em extras:     R$ 210,00         │
│                                                 │
│  Sobra: R$ 210,00 — destinar para:              │
│  ◯ Adicional (produto/serviço extra)            │
│  ◯ Desconto negativo (acréscimo)                │
│  ◯ Crédito futuro (mantém como crédito)         │
│  ◯ Estornar para o cliente                      │
│                                                 │
│  [Cancelar]  [Confirmar reconciliação]          │
└─────────────────────────────────────────────────┘
```

**Lógica do modal:**
- Lê audit_log da galeria (se houver) e oferece como sugestão
- Para sessões sem galeria, mostra apenas ajuste manual + lista de pagamentos da sessão
- A confirmação chama RPC `reconcile_session_extras(session_id, qtd, unit, destino_sobra, valor_sobra)` que:
  1. Atualiza `qtd_fotos_extra`, `valor_foto_extra`, `valor_total_foto_extra`, `regras_congeladas.pacote.valorFotoExtraEfetivo`
  2. Aplica destino da sobra: `valor_adicional` ou `desconto = -X` ou nada (mantém crédito) ou cria estorno
  3. Registra evento no `audit_log` com `action='reconcile_credit'` e snapshot completo

### Fase 3 — Camada de proteção contra perda futura

Adicionar trigger `protect_gallery_extras_downgrade` em `galerias`:

```sql
CREATE OR REPLACE FUNCTION protect_gallery_extras_downgrade()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Se está reduzindo qtd de extras E existem cobranças pagas vinculadas
  IF NEW.total_fotos_extras_vendidas < OLD.total_fotos_extras_vendidas THEN
    IF EXISTS (
      SELECT 1 FROM cobrancas 
      WHERE galeria_id = NEW.id 
        AND status = 'pago'
        AND tipo_cobranca IN ('fotos_extras', 'extras')
    ) THEN
      -- Bloquear E logar
      INSERT INTO audit_log(action, resource_type, resource_id, metadata)
      VALUES('blocked_extras_downgrade', 'galeria', NEW.id::text,
        jsonb_build_object(
          'old_qtd', OLD.total_fotos_extras_vendidas,
          'new_qtd', NEW.total_fotos_extras_vendidas,
          'old_total', OLD.valor_total_vendido,
          'new_total', NEW.valor_total_vendido));
      RAISE EXCEPTION 'Não é possível reduzir fotos extras: existem cobranças pagas vinculadas. Use "Reconciliar crédito" no Workflow.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_protect_gallery_extras_downgrade
  BEFORE UPDATE OF total_fotos_extras_vendidas, valor_total_vendido ON galerias
  FOR EACH ROW EXECUTE FUNCTION protect_gallery_extras_downgrade();
```

### Fase 4 — Badge visual "Crédito não conciliado" (anti-confusão)

Em `WorkflowCardCollapsed.tsx`, ao lado do "+R$ XX,00" amarelo já existente, adicionar tooltip:

> ⚠️ **Crédito não conciliado** — O cliente pagou R$ X a mais que o total da sessão. Clique para reconciliar com fotos extras, adicional ou estorno.

Ao clicar no badge, abre o `ReconcileExtrasModal`.

---

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/[ts]_recover_extras_via_audit_log.sql` | Backup + restauração das 10 galerias do Grupo A + trigger `protect_gallery_extras_downgrade` + RPC `reconcile_session_extras` |
| `src/components/workflow/ReconcileExtrasModal.tsx` *(novo)* | Modal com sugestão do audit_log + ajuste manual + destino da sobra |
| `src/hooks/useReconcileExtras.ts` *(novo)* | Hook que carrega audit_log da galeria e chama a RPC |
| `src/components/workflow/WorkflowCardCollapsed.tsx` | Tornar o badge "+R$ XX,00" clicável → abre o modal |
| `src/components/workflow/WorkflowCardExpanded.tsx` | Botão secundário "Reconciliar crédito" quando há crédito |

---

## Resultado esperado

**Imediato (após migration):**
- 10 sessões do Grupo A: crédito vai a **R$ 0**, fotos extras restauradas com desconto progressivo correto
- 4 casos do Grupo B: continuam com badge amarelo, mas agora **clicável** para reconciliação assistida
- Total recuperado automaticamente: **R$ 1.222,00** em fotos extras "esquecidas"

**Médio prazo (uso do modal):**
- Usuário pode reconciliar os 4 casos restantes em < 1 minuto cada
- Decisão sobre sobras (adicional/desconto/estorno) fica registrada no audit_log

**Longo prazo (proteção):**
- Não é mais possível reduzir fotos extras na galeria se houver cobrança paga
- Bug não pode mais "comer" dados financeiros silenciosamente
- Junto com os triggers anti-divergência da migration anterior, são **4 camadas de proteção**

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Audit_log com dados errados | Validamos: 10/10 batem matematicamente (`pago - base - audit_total = 0`) |
| Galeria recriada / audit_log apagado | Backup completo antes; RPC permite ajuste manual |
| Cliente clicar "Aplicar sugestão" sem revisar | Modal mostra valores em destaque + botão "Cancelar"; toda mudança vai para audit_log |
| Sessão sem audit_log (Grupo B) | Modal cai para fluxo 100% manual, com lista dos pagamentos visível |
| Trigger de proteção bloquear caso legítimo | Mensagem de erro orienta uso do modal de reconciliação |
