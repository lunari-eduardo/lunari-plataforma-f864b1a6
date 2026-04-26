## 🐛 Causa raiz

O `ContratoRichEditor` foi escrito para **Tiptap v2** mas o projeto usa **Tiptap v3** (`^3.22.4`). Duas incompatibilidades quebram o carregamento de conteúdo:

1. **`setContent(value, { emitUpdate: false })`** — Em v3 a assinatura mudou: `setContent(content, options?)`. A chave correta é `emitUpdate` dentro de `options`, mas o efeito está rodando **antes** do editor estar 100% pronto (o `useEditor` retorna o instance, mas o estado inicial demora um frame).
2. **`immediatelyRender`** — Tiptap v3 exige `immediatelyRender: false` para garantir que o conteúdo passado via prop seja aplicado corretamente em re-renders do React (Strict Mode duplica a montagem e o conteúdo "passa batido").

Resultado visível (screenshots):
- Modelo "Casamento" pré-preenchido → editor aparece **vazio** mesmo com o seed populando o estado.
- Template "padrão" já salvo → ao reabrir, editor aparece **vazio** (mas o conteúdo está no banco).

O conteúdo dos 4 modelos profissionais **já existe íntegro** em `src/utils/contratoSeedTemplates.ts` (Casamento, Ensaio, Newborn, Evento com todas as 9 cláusulas e variáveis solicitadas). O problema é puramente de renderização.

---

## ✅ Correções

### 1. `src/components/contratos/ContratoRichEditor.tsx`
- Adicionar `immediatelyRender: false` na config do `useEditor` (requisito v3).
- Adicionar `shouldRerenderOnTransaction: false` para performance.
- Trocar a sincronização externa para usar a API correta v3:
  ```ts
  editor.commands.setContent(value || '', false) // segundo arg = emitUpdate boolean em v3
  ```
  ou usar `editor.commands.setContent(value || '', { emitUpdate: false, parseOptions: { preserveWhitespace: 'full' } })` com a key correta.
- Garantir que o effect de sincronização **espera o editor estar pronto** comparando depois de um microtask, e usar `editor.isEmpty` como fallback de detecção quando `value` chega com conteúdo e o editor ainda está vazio.
- Não depender só de `[value]` — incluir o `editor` na dependency e checar `editor.view` antes de chamar `setContent`.

### 2. Validar render do HTML dos modelos
- Os modelos seed usam `<h2>`, `<h3>`, `<strong>`, `<br/>`, `<p style="...">`. O `StarterKit` v3 inclui Heading (níveis 1-6) e Paragraph por padrão — funciona.
- O `style="margin-top:48px"` inline é preservado pelo Tiptap se o schema permitir; se não, vira `<p>` simples (aceitável — apenas perde espaçamento das linhas de assinatura).

### 3. Teste de regressão visual
Após o fix, os 3 fluxos abaixo devem mostrar o HTML correto no editor:
- Abrir "Modelo pronto → Casamento" → editor mostra "Contrato de Prestação de Serviços Fotográficos – Casamento" com 9 seções.
- Abrir "Editar" no modelo "Contrato padrão de prestação de serviços" existente → mostra o conteúdo salvo no banco.
- Criar novo modelo do zero → editor vazio com placeholder.

---

## 📦 Arquivos alterados

- `src/components/contratos/ContratoRichEditor.tsx` — fix Tiptap v3 (config + sync effect).

Nenhuma alteração de banco de dados, nenhuma alteração nos modelos seed (já estão corretos), nenhuma mudança em `ContratoTemplateEditorModal` ou `ContratosConfig` (a lógica de estado já está certa — só o editor não renderizava).

---

## 🚫 Fora do escopo

- Não vou recriar os modelos seed (o conteúdo já está completo e fiel ao que você passou).
- Não vou mexer no `RichTextEditor` antigo (`src/components/ui/rich-text-editor.tsx` baseado em `contentEditable`) — ele é usado em outros lugares e funciona.
- Não vou trocar de biblioteca — Tiptap v3 é correto, só precisa da config certa.
