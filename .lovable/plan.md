## 🎯 Problema

No `ContratoTemplateEditorModal`, a função `insertVariable` apenas concatena `<p>{{key}}</p>` ao final do `conteudo` (string HTML). Por isso, mesmo com o cursor no meio do texto, a variável sempre vai parar no rodapé do documento.

```ts
// src/components/contratos/ContratoTemplateEditorModal.tsx (atual)
const insertVariable = (key: string) => {
  setConteudo((prev) => `${prev.trimEnd()}<p>{{${key}}}</p>`);
};
```

Além disso, o `ContratoRichEditor` já expõe um `editorRef` (contentEditable nativo), mas o helper `insertVariableIntoEditor` é um no-op.

## ✅ Solução

Permitir que a variável seja inserida **exatamente na posição do cursor (caret)** dentro do editor, mantendo o append ao final apenas como fallback (quando o editor nunca recebeu foco).

### Mudanças

**1. `src/components/contratos/ContratoRichEditor.tsx`**
- Expor uma API imperativa via `forwardRef` + `useImperativeHandle` com o método:
  - `insertVariableAtCursor(key: string)` — insere o texto `{{key}}` na seleção atual.
- Lógica:
  - `editorRef.current.focus()`
  - Recuperar `window.getSelection()`. Se a seleção não estiver dentro do editor (ou inexistente), mover o caret para o final do editor antes de inserir (fallback seguro).
  - Usar `document.execCommand('insertText', false, '{{key}}')` — preserva o histórico de undo/redo nativo e funciona bem em todos os navegadores baseados em Chromium/WebKit/Firefox.
  - Disparar `emitChange()` para sincronizar o estado externo.
- Guardar internamente a última `Range` válida em `onBlur` (lastRangeRef) — assim, ao clicar num botão de variável (que rouba o foco), conseguimos restaurar o caret correto antes de inserir.

**2. `src/components/contratos/ContratoTemplateEditorModal.tsx`**
- Criar um `editorRef = useRef<ContratoRichEditorHandle>(null)` e passar ao `<ContratoRichEditor ref={editorRef} ... />`.
- Refatorar `insertVariable`:
  ```ts
  const insertVariable = (key: string) => {
    if (editorRef.current?.insertVariableAtCursor) {
      editorRef.current.insertVariableAtCursor(key);
      return;
    }
    // Fallback: append ao final
    setConteudo(prev => `${(prev || '').trimEnd()}<p>{{${key}}}</p>`);
  };
  ```
- Botões de variável (`renderVarButton`) precisam usar `onMouseDown={e => e.preventDefault()}` para **não roubar o foco** do editor antes do clique — assim a seleção é preservada e o `insertText` cai exatamente onde o cursor estava.
- Atualizar o texto auxiliar de "Clique para adicionar ao final." para algo como "Clique para inserir na posição do cursor."

**3. UX adicional**
- Sem mudanças visuais. Comportamento agora respeita o caret e mantém compatibilidade com o fallback (caso o usuário nunca tenha focado o editor, ainda funciona).

## 📋 Arquivos afetados

- `src/components/contratos/ContratoRichEditor.tsx` — converter para `forwardRef`, expor `insertVariableAtCursor`, rastrear última Range válida.
- `src/components/contratos/ContratoTemplateEditorModal.tsx` — usar ref para inserir e ajustar `onMouseDown` dos botões + texto da legenda.

## 🧪 Cenários cobertos

1. Cursor posicionado no meio de um parágrafo → variável aparece no ponto exato.
2. Texto selecionado → seleção é substituída pela variável (comportamento natural do `insertText`).
3. Editor nunca focado / sem seleção → cai no fallback e adiciona ao final.
4. Undo/redo do navegador continuam funcionando (uso de `execCommand`).
