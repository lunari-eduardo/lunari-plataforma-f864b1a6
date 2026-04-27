
## 🎯 Objetivo

Eliminar a confusão dos placeholders amarelos `[duracao_sessao]` que aparecem no contrato gerado quando não há campo correspondente no sistema. Em vez de mostrar variáveis "quebradas", transformá-las em **campos editáveis destacados** (preenchimento sugerido + visual clicável) e manter as **variáveis automáticas** apenas para dados que realmente vivem no banco.

---

## 📊 Diagnóstico atual

Hoje (em `src/utils/contratoVariables.ts` e `applyVariables`):
- Toda variável `{{xxx}}` que não tem dado é renderizada como `<span>[xxx]</span>` em amarelo
- Variáveis manuais (ex.: `duracao_sessao`, `valor_sinal`, `quantidade_fotos`, `fornecimento_figurino`) **nunca** têm dado — pois não existe UI para preencher
- Resultado: contrato gerado vem cheio de `[duracao_sessao]` em amarelo, parecendo "erro"

A análise do usuário está correta:
- ❌ Manter como variável → confunde, parece bug
- ❌ Hardcode no template → perde flexibilidade
- ✅ **Campos editáveis destacados com sugestão padrão** → mostra valor sugerido, fica claro que é manual e edita-se direto no editor

---

## 🏗️ Arquitetura proposta

### 1. Reclassificar variáveis em **dois tipos**

**Tipo A — Variáveis automáticas (sistema)**
Têm origem garantida no banco. Renderizadas em **azul** (chip discreto) e substituídas no momento de gerar o contrato. Lista:
- `nome_cliente`, `email_cliente`, `cpf_cliente`, `documento_cliente`
- `nome_fotografo`, `documento_fotografo`, `cidade_fotografo`, `email_fotografo`
- `data_sessao` / `data_evento`, `horario_inicio` / `horario_sessao`
- `tipo_ensaio` / `tipo_evento` (categoria), `valor_total`
- `data_atual`, `cidade_atual`

**Tipo B — Campos editáveis (manuais)**
Não existem no sistema. Em vez de virarem `[xxx]` em amarelo, são substituídos por um **valor sugerido padrão** envolto num span destacado:

```html
<span class="contrato-campo-editavel" data-campo="duracao_sessao">2 horas</span>
```

Lista do Tipo B (com sugestão padrão):
| Variável | Sugestão padrão |
|---|---|
| `duracao_sessao` | `2 horas` |
| `duracao_maxima` | `4 horas` |
| `quantidade_fotos` | `20 fotos tratadas` |
| `valor_sinal` | `R$ 0,00` |
| `valor_hora_extra` | `R$ 0,00` |
| `valor_foto_extra` | `R$ 0,00` |
| `taxa_deslocamento` | `R$ 0,00` |
| `valor_taxa_dano` | `R$ 0,00` |
| `forma_pagamento` | `PIX / Cartão / Transferência` |
| `descricao_forma_pagamento` | `30% de sinal + saldo até 5 dias antes do evento` |
| `prazo_entrega` | `30 dias úteis` |
| `prazo_entrega_final` | `45 dias úteis` |
| `prazo_selecao` | `15 dias úteis` |
| `dias_aviso_previo` | `7` |
| `dias_multa_cancelamento` | `30` |
| `porcentagem_multa` | `50` |
| `fornecimento_figurino` | `não está incluso` |
| `fornecimento_figurino` | `não está incluso` |
| `local_ensaio` / `local_evento` | `a definir` |
| `horario_termino` | `a definir` |
| `tipo_ensaio` (quando sem categoria) | `a definir` |
| `cidade_cliente` / `estado_cliente` | `a definir` / `--` |
| `rg_cliente` | `a informar` |
| `nome_bebe` | `a informar` |

### 2. Visual diferenciado no editor (CSS)

Adicionar classes globais (em `src/index.css` ou estilos do editor):

```css
/* Variável automática resolvida (apenas leitura visual) */
.contrato-var-auto {
  background: hsl(var(--primary) / 0.08);
  color: hsl(var(--primary));
  padding: 0 4px;
  border-radius: 3px;
  font-weight: 500;
}

/* Campo editável manual — destaque suave + cursor de edição */
.contrato-campo-editavel {
  background: hsl(45 100% 95%);        /* amarelo clarinho */
  border-bottom: 1px dashed hsl(35 90% 55%);
  padding: 0 3px;
  border-radius: 2px;
  cursor: text;
  transition: background 120ms;
}
.contrato-campo-editavel:hover,
.contrato-campo-editavel:focus {
  background: hsl(45 100% 88%);
  outline: none;
}
```

Os campos editáveis **continuam editáveis** porque o editor é `contentEditable` — o usuário clica e digita por cima normalmente. O `data-campo` permanece como metadado opcional (não atrapalha).

### 3. Atualização da lógica `applyVariables`

Em `src/utils/contratoVariables.ts`:
- Receber um segundo argumento `defaults: Record<string, string>` com os valores sugeridos do Tipo B
- Para cada `{{xxx}}` encontrado:
  - Se há valor real (Tipo A com dado) → `<span class="contrato-var-auto">valor</span>`
  - Se está em `defaults` (Tipo B) → `<span class="contrato-campo-editavel">sugestão</span>`
  - Se não existe em nenhum mapa → manter `{{xxx}}` (variável legada/desconhecida) — não polui mais com `[xxx]` amarelo

Exportar `CAMPOS_EDITAVEIS_DEFAULTS` com a tabela acima.

### 4. UI do painel lateral de variáveis (`ContratoTemplateEditorModal`)

Reorganizar em 2 seções claras com ícones:

```
🔵 Automáticas (preenchidas pelo sistema)
   nome_cliente, email_cliente, valor_total, …

🟡 Campos editáveis (você ajusta no contrato)
   duracao_sessao, valor_sinal, quantidade_fotos, …

▾ Legadas
```

Cada botão mostra um chip colorido (azul/amarelo) para reforçar a diferença. O texto de ajuda do topo passa a:
> *Variáveis azuis são preenchidas automaticamente. Variáveis amarelas viram campos editáveis com valor sugerido — clique no contrato para ajustar.*

### 5. Ao gerar o contrato (`NovoContratoModal`)

Passa `CAMPOS_EDITAVEIS_DEFAULTS` para o `applyVariables`, gerando um conteúdo onde:
- Dados reais do cliente/sessão já estão preenchidos (azul)
- Lacunas viram texto sugerido editável (amarelo suave)
- Usuário só revisa/ajusta o que realmente precisa

O painel de "Variáveis que serão preenchidas" passa a mostrar apenas as **automáticas** (não polui com manuais).

---

## 📁 Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/utils/contratoVariables.ts` | Adicionar `CAMPOS_EDITAVEIS_DEFAULTS`; reescrever `applyVariables` para gerar 2 estilos de span; reclassificar `grupo` das variáveis para `'auto' \| 'editavel' \| 'legacy'` |
| `src/utils/contratoSeedTemplates.ts` | Sem mudança de conteúdo — os templates já usam as variáveis certas |
| `src/components/contratos/ContratoTemplateEditorModal.tsx` | Reorganizar painel lateral em "Automáticas" / "Campos editáveis" / "Legadas" com chips coloridos; atualizar texto de ajuda |
| `src/components/contratos/NovoContratoModal.tsx` | Passar defaults ao `applyVariables`; ajustar preview lateral para mostrar só auto |
| `src/components/contratos/ContratoRichEditor.tsx` | Permitir as classes `contrato-var-auto` e `contrato-campo-editavel` no DOMPurify (já permite `class` via `ALLOWED_ATTR`, só validar) |
| `src/index.css` (ou similar global) | Adicionar estilos `.contrato-var-auto` e `.contrato-campo-editavel` |
| `src/components/contratos/ContratoViewerModal.tsx` | Garantir que os estilos também apareçam quando o contrato é visualizado/impresso (ou neutralizar campos editáveis no PDF final) |

---

## ✅ Resultado esperado

- Contrato gerado **não tem mais `[xxx]` em amarelo** — só dados reais (azul) ou sugestões editáveis (amarelo suave com sublinhado tracejado)
- Usuário entende imediatamente: *"azul = automático, amarelo = eu edito"*
- Edição inline já funciona porque é `contentEditable`
- Templates seed continuam usando `{{variavel}}` — a diferença é apenas na geração do contrato
- Compatibilidade total com modelos antigos (variáveis legadas continuam funcionando)

---

## ❓ Pontos de decisão para confirmar

1. **Defaults sugeridos** — a lista da tabela acima está adequada? Quer ajustar algum valor padrão (ex.: `quantidade_fotos = 30 fotos` em vez de `20`)?
2. **Variáveis automáticas sem dado** (ex.: gerar contrato sem sessão vinculada → `valor_total` vazio) — devem virar campo editável amarelo (`a definir`) ou permanecer azul vazio? Recomendação: virar editável amarelo para nunca haver lacuna invisível.
3. **No PDF/visualização final** — os campos editáveis amarelos devem aparecer estilizados (mostrando que foi um campo manual) ou **neutros** (sem cor)? Recomendação: neutros no PDF, destacados apenas no editor.

