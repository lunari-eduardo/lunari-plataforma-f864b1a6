
# Plano: corrigir desconto progressivo das fotos extras na sessão e blindar contra regressões

## Diagnóstico técnico (confirmado no banco)

### O caso Louise-Lorena (14/02/2026)

| Campo | Galeria (correto) | Sessão (errado) | Esperado |
|---|---|---|---|
| Qtd fotos extras | 6 | 6 | 6 |
| Valor unitário base | 25 | **25** | 23 (faixa 4-7) |
| **Total fotos extras** | **138** | **150** | **138** |
| Valor base pacote | — | 130 | 130 |
| **Valor total sessão** | — | **280** | **268** |
| Valor pago | — | 268 | 268 |
| **Pendente falso** | — | **R$ 12** | **R$ 0** |

A galeria salvou corretamente `valor_total_vendido = 138` (6 × R$ 23 com desconto da faixa 4-7 da Tabela Mensal). A sessão recebeu `valor_total_foto_extra = 138` via trigger de sync, **mas foi sobrescrita** para R$ 150.

### Causa raiz exata

Existem **dois triggers conflitantes** rodando em sequência na tabela `clientes_sessoes`:

**Trigger A** — `recalc_fotos_extras` (BEFORE INSERT/UPDATE):
```sql
NEW.valor_total_foto_extra = NEW.qtd_fotos_extra * NEW.valor_foto_extra;
-- = 6 * 25 = 150  ← sobrepõe o 138 que veio da galeria
```

**Trigger B** — `trigger_recalculate_valor_total` (BEFORE INSERT/UPDATE):
```sql
NEW.valor_total = valor_base_pacote + valor_total_foto_extra + ... 
-- = 130 + 150 = 280  ← deveria ser 268
```

Quando o trigger `sync_gallery_extras_to_session` (na tabela `galerias`) faz:
```sql
UPDATE clientes_sessoes 
SET valor_foto_extra = 25,        -- preço base, sem desconto
    qtd_fotos_extra = 6,
    valor_total_foto_extra = 138; -- valor real cobrado COM desconto
```

…o trigger A intercepta o UPDATE e **descarta o valor de 138** porque recalcula "ingenuamente" `qtd × preço_base`, ignorando que o modelo de precificação progressiva (`global` ou `categoria`) tem um preço unitário **diferente por faixa**.

### Escopo do problema

Query confirmou **20 sessões afetadas** no histórico, totalizando **R$ 382,00 de pendente "fantasma"**. Padrões:

- **Categoria Mensal** (faixas 1-3=R$25, 4-7=R$23, 8+=R$21) — maioria dos casos
- **Categoria Newborn** com tabela progressiva semelhante
- **Categoria Páscoa 26**, **Gestantes**, **Smash**

Exemplos reais detectados (todos com `pago = total real esperado`, mas sistema mostra pendente):
- Louise-Lorena 14/02 — 6 extras, pago 268, pendente fantasma R$ 12
- Lisiane-Otávio 24/03 — 6 extras, pago 268, pendente fantasma R$ 12
- Paola Pereira 21/02 — 10 extras, pago 340, pendente fantasma R$ 40
- Priscila Richa 12/04 — 14 extras, pago 1.190, pendente fantasma R$ 56

---

## Proposta de correção

### Princípio de design

A galeria continua sendo a **fonte da verdade do total cobrado** (`valor_total_vendido`), porque é ela quem aplica o desconto progressivo conforme a tabela congelada. A sessão precisa apenas **respeitar esse total** e **derivar o preço unitário efetivo** (`total ÷ qtd`) para que `qtd × valor_foto_extra = valor_total_foto_extra` continue sendo verdade — assim a UI atual (que mostra "Vlr foto extra" e "Qtd fotos extras") continua coerente sem reescrever componente nenhum.

### Fase 1 — Corrigir o trigger `recalculate_fotos_extras_total` (a causa raiz)

Mudar a lógica para **não sobrepor** `valor_total_foto_extra` quando ele já vem definido pela sincronização com a galeria. Regra:

```text
SE a sessão está vinculada a uma galeria (galeria_id IS NOT NULL)
   E a galeria define valor_total_vendido > 0
   E o NEW.valor_total_foto_extra recebido bate com o da galeria:
   
   → manter o valor recebido (vem do desconto progressivo)
   → derivar valor_foto_extra = valor_total_foto_extra / qtd_fotos_extra
   
SENÃO (sessão avulsa, sem galeria, ou edição manual):
   → manter comportamento atual: total = qtd × unit
```

Isso resolve **todas as 20 sessões** automaticamente quando o trigger de sync rodar de novo, sem depender de backfill.

### Fase 2 — Corrigir o trigger `sync_gallery_extras_to_session`

Em vez de copiar `valor_foto_extra = NEW.valor_foto_extra` (preço base de tabela), passar a copiar o **preço unitário efetivo**:

```sql
v_unit_efetivo := CASE 
  WHEN NEW.total_fotos_extras_vendidas > 0 
  THEN ROUND((NEW.valor_total_vendido / NEW.total_fotos_extras_vendidas)::numeric, 2)
  ELSE NEW.valor_foto_extra
END;

UPDATE clientes_sessoes SET
  valor_foto_extra = v_unit_efetivo,           -- 23 em vez de 25
  qtd_fotos_extra = NEW.total_fotos_extras_vendidas,
  valor_total_foto_extra = NEW.valor_total_vendido;
```

Combinado com a Fase 1, o `recalc_fotos_extras` vai validar: `6 × 23 = 138` ✅ e não sobrepor.

### Fase 3 — Backfill seguro das 20 sessões já corrompidas

Migration única, com `BEGIN/COMMIT` e tabela de backup:

```sql
-- Backup
CREATE TABLE backup_sessoes_desconto_progressivo_20260424 AS
SELECT cs.*, g.valor_total_vendido AS gal_total, g.total_fotos_extras_vendidas AS gal_qtd
FROM clientes_sessoes cs JOIN galerias g ON g.id = cs.galeria_id
WHERE g.total_fotos_extras_vendidas > 0 AND g.valor_total_vendido > 0
  AND ABS(g.valor_total_vendido - (g.total_fotos_extras_vendidas * cs.valor_foto_extra)) > 0.01;

-- Correção: deriva valor_foto_extra do total real da galeria
UPDATE clientes_sessoes cs
SET valor_foto_extra = ROUND((g.valor_total_vendido / g.total_fotos_extras_vendidas)::numeric, 2),
    qtd_fotos_extra = g.total_fotos_extras_vendidas,
    valor_total_foto_extra = g.valor_total_vendido,
    updated_at = now()
FROM galerias g
WHERE cs.galeria_id = g.id
  AND g.total_fotos_extras_vendidas > 0
  AND g.valor_total_vendido > 0
  AND ABS(g.valor_total_vendido - (g.total_fotos_extras_vendidas * cs.valor_foto_extra)) > 0.01;
```

O trigger `recalculate_session_valor_total` recalcula `valor_total` automaticamente após o UPDATE → as 20 sessões saem com `valor_total = base + total_extras_real` e `pendente = 0`.

### Fase 4 — Atualizar `regras_congeladas.pacote.valorFotoExtra` da sessão

Para que a UI do modal mostre o **preço unitário efetivo** em "Vlr foto extra" sem ficar piscando entre 25 (regra) e 23 (efetivo), atualizar o JSONB também:

```sql
regras_congeladas = jsonb_set(
  regras_congeladas,
  '{pacote, valorFotoExtraEfetivo}',     -- novo campo, NÃO sobrescreve valorFotoExtra
  to_jsonb(v_unit_efetivo)
)
```

**Não vamos sobrescrever** `valorFotoExtra` original (ela continua sendo o "preço de tabela base") — apenas adicionar `valorFotoExtraEfetivo` com o preço unitário **realmente cobrado** após desconto progressivo. Isso preserva auditoria.

### Fase 5 — UI: badge informativo de "desconto progressivo aplicado"

Em `WorkflowCardExpanded.tsx`, quando `regras_congeladas.pacote.valorFotoExtraEfetivo < regras_congeladas.pacote.valorFotoExtra`:

- Mostrar pequeno tooltip ao lado de "Vlr foto extra": **🏷️ Desconto progressivo: R$ 25 → R$ 23 (faixa 4–7)**
- Tornar o input não-editável neste caso (já é hoje quando há galeria) e exibir cadeado com tooltip explicativo

Sem novos componentes pesados — apenas um `<TooltipProvider>` em volta do label.

### Fase 6 — Camada de proteção contra regressão

Adicionar **trigger BEFORE UPDATE** em `clientes_sessoes` que **bloqueia** divergências entre sessão e galeria:

```sql
CREATE OR REPLACE FUNCTION public.protect_session_extras_consistency() ...
-- Se NEW.galeria_id IS NOT NULL e a galeria tem valor_total_vendido > 0,
-- valida que NEW.valor_total_foto_extra = galeria.valor_total_vendido
-- Caso contrário, RAISE WARNING + log no audit_log e força o valor da galeria.
```

Isso garante que **mesmo edição manual via UI** não consegue introduzir o bug de novo. Combinado com o `AlertDialog` que já existe no `WorkflowCardExpanded`, qualquer tentativa de divergir aciona aviso e auto-correção.

---

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/[ts]_fix_progressive_discount_extras.sql` | Backup, backfill 20 sessões, correção `recalculate_fotos_extras_total`, correção `sync_gallery_extras_to_session`, novo trigger `protect_session_extras_consistency` |
| `src/components/workflow/WorkflowCardExpanded.tsx` | Tooltip "Desconto progressivo aplicado" no campo "Vlr foto extra" quando `valorFotoExtraEfetivo` existir e for menor que `valorFotoExtra` |
| `src/utils/sessionCalculations.ts` | (opcional) Helper `getEffectiveExtraPrice(regras)` retornando `valorFotoExtraEfetivo ?? valorFotoExtra` para uso consistente |

---

## Resultado esperado após aplicar

- **20 sessões** corrigidas automaticamente, **R$ 382 de pendente fantasma desaparecem**
- Sessões com desconto progressivo (Mensal, Newborn, Páscoa, Gestantes, Smash) passam a refletir o **valor real cobrado pela galeria**
- UI mostra `Vlr foto extra: R$ 23` em vez de R$ 25 nessas sessões — com tooltip explicando o desconto
- **Bug não pode mais ser reintroduzido**: 3 camadas de proteção (trigger de recálculo corrigido, trigger de sync corrigido, trigger de proteção que bloqueia divergência)
- **Sessões avulsas** (sem galeria) **continuam funcionando como hoje** (`qtd × unit = total`)
- Backup completo em `backup_sessoes_desconto_progressivo_20260424` permite rollback se necessário
- **Nenhum dado financeiro real** (`valor_pago`, `cobrancas`, `clientes_transacoes`) é alterado — só corrigimos `valor_total` da sessão para bater com o que a galeria já tinha cobrado corretamente

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Sessão avulsa quebrar com a nova lógica do trigger | Fase 1 só altera comportamento quando `galeria_id IS NOT NULL` |
| Edição manual de qtd/valor em sessão com galeria | Fase 6 detecta e força consistência; Fase 5 sinaliza visualmente que o campo é derivado |
| Galeria sem `valor_total_vendido` (rascunho) | Fase 1 cai no `ELSE` e mantém comportamento atual `qtd × unit` |
| Divisão por zero (qtd=0 mas total>0) | Cláusulas `NULLIF` e `WHEN qtd > 0` em todos os cálculos |
| Backfill afetar sessão errada | Filtro `ABS(...) > 0.01` garante que só toca registros divergentes; backup completo antes |
