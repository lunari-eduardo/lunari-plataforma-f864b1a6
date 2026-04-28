## Diagnóstico (causa-raiz confirmada no banco)

Sessão da imagem (`f3ce12c6-... Rita – Amália`, galeria vinculada `e245375a-...`):

```
clientes_sessoes:
  qtd_fotos_extra        = 3
  valor_foto_extra       = 0      ← ZERADO no banco
  valor_total_foto_extra = 0      ← consequência
  valor_base_pacote      = 350
  valor_total            = 350

galerias (vinculada):
  total_fotos_extras_vendidas = 0
  valor_total_vendido         = 0
  valor_foto_extra            = 25
  regras_congeladas.pacote.valorFotoExtra = 25
```

A sessão é vinculada a uma galeria, mas a galeria **não tem vendas consolidadas** (`total_vendido=0`). Rastreando as triggers em `clientes_sessoes`:

1. **`recalculate_fotos_extras_total` (`recalc_fotos_extras`)** — como `v_gal_total=0`, cai no ramo padrão `valor_total_foto_extra = qtd × valor_foto_extra`. Mas `NEW.valor_foto_extra=0` (vem assim do registro), então total=0.
2. **`sync_gallery_extras_to_session`** (na tabela `galerias`) não ajuda: só executa quando a galeria muda; como a galeria nunca teve venda, `valor_foto_extra` da sessão nunca foi populado a partir dela.
3. **`z_protect_session_extras_consistency`** não interfere (só age quando `v_gal_total>0`).
4. **`sync_session_extra_price_to_frozen`** só patcha o JSON quando `valor_foto_extra` do NEW muda, e clampa 0 quando o frozen já tem valor (`IF v_clamped=0 AND v_current_frozen>0 RETURN NEW`) — não repõe.

Resultado: a sessão ficou com `valor_foto_extra=0` no banco, mesmo com `regras_congeladas.pacote.valorFotoExtra=25`. O hook UI `recalcFotosExtras` multiplica `qtd × 0 = 0`. Por isso "Total fotos extras" fica R$ 0,00 e o pendente não sobe.

Antes (histórico do usuário) funcionava porque: ou (a) a trigger `sync_gallery_extras_to_session` escrevia `valor_foto_extra` na sessão no momento do vínculo mesmo sem vendas (usando `v_unit_base`), ou (b) o frontend tinha fallback para `regras_congeladas.pacote.valorFotoExtra`. Hoje nenhum dos dois acontece para este caso (galeria vinculada sem vendas).

**Secundário:** existem dois inputs de "quantidade fotos extras" no card — na linha do cabeçalho (topo) **e** dentro do bloco "Adicionais" (Qtd fotos extras). Isso é redundante e confuso.

---

## Plano de correção

### 1. Migração de banco — trigger `recalculate_fotos_extras_total`

Alterar a função para, no ramo padrão (galeria sem vendas OU sem galeria), aplicar fallback quando `valor_foto_extra` do registro vier `0/NULL`:

```
fallback_preco := COALESCE(
  NULLIF(NEW.valor_foto_extra, 0),
  (NEW.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric,
  (NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric,
  0
)
NEW.valor_foto_extra       := fallback_preco
NEW.valor_total_foto_extra := COALESCE(NEW.qtd_fotos_extra,0) * fallback_preco
```

Isto também corrige retroativamente qualquer sessão com `valor_foto_extra=0` que tenha `regras_congeladas.pacote.valorFotoExtra` definido: basta um `UPDATE clientes_sessoes SET updated_at=now()` após o deploy para reexecutar a trigger (incluído na migração).

Manter `z_protect_session_extras_consistency` intacta (ela só atua quando galeria tem vendas — mantém integridade do contrato Gallery).

### 2. Frontend — `src/utils/fotosExtrasCalculator.ts`

Espelhar o mesmo fallback na função pura `recalcFotosExtras`, para que a UI otimista acerte mesmo antes do round-trip:

- Se `valorFotoExtra` informado == 0 e existir `regrasCongeladas.pacote.valorFotoExtraEfetivo || regrasCongeladas.pacote.valorFotoExtra > 0`, usar esse valor como unitário efetivo.
- Ajustar o caso "galeria com vendas consolidadas" para usar `respeitarBanco` apenas quando `qtd` bate com `totalFotosExtrasVendidas` E há `valor_total_vendido>0` (já está). Sem mudança aqui.

### 3. Frontend — `Workflow.tsx > updateSession` (optimistic)

No bloco de recálculo otimista (linhas 281–333), passar `currentAny.regras_congeladas` para o helper (já passa). Garantir que o `valorUnit` considerado para recálculo caia no fallback do helper quando `valor_foto_extra=0` — isso já ocorrerá automaticamente com a mudança (2).

Adicionar também: quando o usuário edita apenas `qtdFotosExtra` e a sessão tem `valor_foto_extra=0` mas `regras_congeladas.pacote.valorFotoExtra>0`, gravar explicitamente o `valor_foto_extra` efetivo no `validUpdates` (enviado ao Supabase), para que o banco também fique consistente.

### 4. Frontend — `WorkflowCardExpanded.tsx` — UX dos dois inputs

Remover o input "Qtd fotos extras" duplicado. A fonte de verdade deve ser **um único input**. Baseado na captura e no layout atual:

- Manter o input de "Qtd fotos extras" dentro do **bloco 2 (Adicionais)** — é onde o usuário edita junto com "Total fotos extras" e "Adicional", contexto financeiro coerente.
- Remover o input duplicado que aparece no header do card (coluna FOTOS EXTRAS da linha compacta).
- O header compacto (colapsado) continua exibindo a qtd como **texto somente-leitura** — clicar para expandir o card para editar.

Verificar se esse input superior vem do próprio `WorkflowCardExpanded` ou do componente-pai (linha de cards). Remover apenas a versão redundante, preservando a exibição read-only na linha colapsada.

### 5. Tooltip e feedback visual

- Manter ícone de cadeado `Lock` apenas quando a galeria tem vendas consolidadas (`galeriaStatusPagamento === 'pago'` OU existe `valor_total_vendido>0`). Quando a galeria está vinculada mas sem vendas (caso da Rita), não exibir cadeado — a edição é livre e não requer confirmação modal.
- Atualizar `requestExtraEdit`: só abrir `AlertDialog` de confirmação quando há vendas reais na galeria (não apenas `galeriaId`).

### 6. Verificação

- SQL: após migração + `UPDATE ... SET updated_at=now() WHERE galeria_id IS NOT NULL AND valor_foto_extra=0 AND (regras_congeladas->'pacote'->>'valorFotoExtra')::numeric > 0`, conferir que sessões afetadas ficam com `valor_foto_extra` e `valor_total_foto_extra` corretos.
- UI: editar qtd de 0→3 com galeria vinculada sem vendas → Total fotos extras deve ir a R$ 75,00 instantaneamente, Pendente sobe R$ 75,00.
- UI: sessão com galeria paga (vendas consolidadas) → campos travados, cadeado visível, editar mostra modal de confirmação.
- UI: sessão avulsa sem galeria → edição livre, recálculo imediato (regressão do fluxo anterior que já funcionava).

---

## Arquivos alterados

- `supabase/migrations/<timestamp>_fix_fotos_extras_fallback.sql` — nova migração: atualiza `recalculate_fotos_extras_total` + `UPDATE` de re-execução nas sessões afetadas.
- `src/utils/fotosExtrasCalculator.ts` — fallback para preço congelado quando unitário = 0.
- `src/pages/Workflow.tsx` — enviar `valor_foto_extra` efetivo ao persistir quando a sessão estava com 0.
- `src/components/workflow/WorkflowCardExpanded.tsx` — remover input duplicado; cadeado e confirmação condicionados a vendas reais na galeria.
- (se o input duplicado vier do componente-pai da linha compacta) o pai correspondente (`WorkflowCardHeader` ou equivalente) — remover edição inline ali, manter exibição.

Sem alterações em outros edge-functions ou no projeto Gallery. Integridade do contrato Gallery (quando há vendas) preservada.
