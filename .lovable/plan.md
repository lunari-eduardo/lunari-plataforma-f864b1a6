
## 🎯 Objetivo
Corrigir o download do PDF de contratos, que atualmente sai totalmente em branco. O PDF deve renderizar **cabeçalho, parágrafos formatados, listas, espaçamento, dados do fotógrafo e variáveis** corretamente.

---

## 🔍 Causas identificadas (investigação completa)

| # | Causa | Impacto |
|---|---|---|
| 1 | Container posicionado em `position: fixed; left: -9999px` | html2canvas não consegue capturar elementos fora do viewport — gera canvas em branco |
| 2 | Container sem `width` explícita | html2canvas calcula 0px de largura |
| 3 | Cadeia `html2pdf().set().from().outputPdf()` instável | A chain correta é `.from().set().toPdf().output('blob')` ou await na cadeia completa |
| 4 | `pagebreak: 'avoid-all'` | Tenta evitar quebras em TUDO e pode empurrar conteúdo para fora |
| 5 | Spans `.contrato-var-auto` / `.contrato-campo-editavel` usam **CSS variables Tailwind** (`hsl(var(--primary))`) | html2canvas não resolve CSS variables em todos os contextos → texto pode sair invisível |
| 6 | `margin` horizontal zero + padding interno do container | Layout pode estourar e cortar conteúdo |
| 7 | Container injetado fora da árvore visível pode não herdar fontes web carregadas | Texto vazio se a fonte ainda não carregou |

---

## 🛠️ Correções propostas

### 1. Reescrever `src/utils/contratoPdf.ts`

**Mudanças no container:**
- Trocar `position: fixed; left: -9999px` por **container visível porém oculto**: `position: absolute; top: 0; left: 0; opacity: 0; pointer-events: none; z-index: -1;`
- Adicionar **`width: 794px`** explícita (largura A4 a 96dpi).
- Adicionar `background: #ffffff` explícito (evita transparência).
- Adicionar `color: #111827` explícito como base.

**Mudanças no HTML:**
- Substituir todos os estilos que dependem de CSS variables por **cores hex literais** dentro do `buildHtmlDocument`.
- **Inlinear** estilos para `.contrato-var-auto` e `.contrato-campo-editavel` no próprio HTML do PDF (estilos `<style>` dentro do container) — usando cores fixas, sem depender do CSS global do app.
- Adicionar reset básico (`* { box-sizing: border-box; }`).

**Mudanças na chain do html2pdf:**
- Trocar para o padrão estável:
  ```ts
  const worker = html2pdf().from(container).set(opts);
  await worker.toContainer().toCanvas().toPdf();
  const blob = worker.output('blob');
  ```
  Ou mais simples e confiável:
  ```ts
  const blob = await html2pdf().set(opts).from(container).outputPdf('blob');
  ```
  garantindo `await` correto.
- Trocar `pagebreak: 'avoid-all'` por `pagebreak: { mode: ['css', 'legacy'] }` (mais permissivo, deixa o conteúdo fluir entre páginas).
- Ajustar `margin` para `[15, 15, 15, 15]` (mm) — margens iguais nos 4 lados.
- Adicionar `html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 794 }` para forçar fundo branco e largura.

**Garantia de fontes carregadas:**
- Antes de gerar, aguardar `document.fonts.ready` (se disponível) para evitar PDF sem texto por falta de fonte.

### 2. Garantir compatibilidade do conteúdo do contrato no PDF

- Antes de injetar `conteudoHtml` no container, **substituir as classes** `contrato-var-auto` e `contrato-campo-editavel` pelos estilos inline equivalentes (cores hex), para que funcionem mesmo sem o CSS global.
  - Exemplo: regex simples que troca `class="contrato-var-auto"` por `style="color:#0f172a;font-weight:500"` (ou similar, já neutralizado para o PDF).
  - Manter o conteúdo dos spans intacto.

### 3. Validação visual

Após implementar, fazer um teste manual:
1. Abrir um contrato existente.
2. Clicar em "Baixar PDF".
3. Verificar:
   - ✅ Cabeçalho com título e dados do fotógrafo aparece.
   - ✅ Parágrafos com espaçamento correto.
   - ✅ Listas (`ul`, `ol`) formatadas.
   - ✅ Negrito / itálico preservados.
   - ✅ Variáveis preenchidas (sem fundo colorido — texto neutro).
   - ✅ Rodapé com data de emissão.
   - ✅ Quebra de página funciona em contratos longos.

---

## 📁 Arquivos que serão alterados

- `src/utils/contratoPdf.ts` — reescrita completa da função de geração.

(Não há mudanças em outros arquivos — o conteúdo HTML do contrato em si já está correto; o problema é exclusivo do pipeline de conversão.)

---

## ⚠️ Alternativa, caso o html2pdf.js continue instável

Se mesmo após as correções acima o html2pdf.js apresentar comportamento errático (já é uma lib não mantida), o plano de contingência é migrar para **`jsPDF` + `html` plugin nativo** (`jspdf` já vem como dependência transitiva do html2pdf.js). Mas começamos pela correção mínima para não trocar de stack desnecessariamente.
