## Objetivo

Duas melhorias no modal de contratos enviados:

1. **Colapsar o conteúdo do contrato** quando já enviado, priorizando status e ações.
2. **Corrigir URL de fallback do fotógrafo** que está retornando 404.

---

## 1. Card colapsável para o conteúdo (`ContratoViewerModal.tsx`)

Quando o contrato **não está em rascunho** (`!isEditable`), o texto longo do contrato vira referência. Hoje ele empurra o bloco da Autentique e os botões de ação para baixo da dobra.

### Mudanças

- Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` de `@/components/ui/collapsible` e `ChevronDown` de `lucide-react`.
- Estado: `const [conteudoOpen, setConteudoOpen] = useState(isEditable)` — aberto em rascunho, fechado em enviado/assinado/cancelado.
- Em rascunho: comportamento atual (editor sempre visível e editável).
- Em enviado/assinado/cancelado: envolver o `ContratoRichEditor` em um `Collapsible`:
  - Trigger: card com `flex items-center justify-between w-full p-3 rounded-lg border hover:bg-muted/40`, ícone `FileText`, label **"Conteúdo do contrato"**, hint à direita "Clique para visualizar" e chevron animado (`rotate-180` quando aberto).
  - Content: `ContratoRichEditor` read-only com `minHeight: 400px`.

### Reordenação no modo enviado

Nova ordem dentro do scroll do modal (de cima para baixo):

1. Banner verde "Contrato assinado" (se aplicável).
2. **Bloco "Enviado via Autentique"** (sobe para o topo) com:
   - Sub-status "Aguardando X de Y assinaturas".
   - Banner âmbar "Sua assinatura está pendente" + botões `Assinar agora` / `Copiar link` / `Receber por e-mail`.
   - Lista de signers.
3. Grid Status + PDF assinado anexado.
4. **Card colapsado "Conteúdo do contrato"** ao final.

Footer continua sticky com `Excluir`, `Baixar rascunho`/`Baixar PDF assinado`, `Salvar`.

---

## 2. Corrigir link de fallback do fotógrafo (404)

### Problema

Em `src/utils/contratoSigners.ts`, quando a Autentique não devolve `short_link` para o fotógrafo (dono da conta API), gerávamos:

```
https://app.autentique.com.br/documentos/visualizar/{id}  → 404
```

A URL correta no painel da Autentique é:

```
https://app.autentique.com.br/documentos/{id}
```

### Mudança

Em `src/utils/contratoSigners.ts`, dentro de `getFotografoPendente`, ajustar o `fallbackLink`:

```ts
const fallbackLink = contrato.signature_external_id
  ? `https://app.autentique.com.br/documentos/${contrato.signature_external_id}`
  : null;
```

### Propagar para o backend

A mesma URL é montada no e-mail enviado pela edge function `autentique-notify-signer` (caso ela use fallback) e em qualquer outro ponto que referencie `documentos/visualizar/`. Buscar e substituir todas as ocorrências de `documentos/visualizar/` por `documentos/` em:

- `src/utils/contratoSigners.ts`
- `supabase/functions/autentique-notify-signer/index.ts` (se houver)
- Qualquer outro lugar do código que monte essa URL.

---

## Arquivos afetados

- `src/components/contratos/ContratoViewerModal.tsx` — card colapsável + reordenação.
- `src/utils/contratoSigners.ts` — corrigir URL de fallback.
- `supabase/functions/autentique-notify-signer/index.ts` — corrigir URL se construída lá também.

## Resultado esperado

- Ao reabrir um contrato enviado, o usuário vê de imediato: status, banner âmbar com "Assinar agora", lista de signers e ações — sem rolar. O conteúdo do contrato fica disponível em um card recolhível ao final.
- O botão/link "Assinar agora" e "Copiar link" passam a abrir corretamente o painel da Autentique, sem 404.