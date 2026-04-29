## Diagnóstico

Confirmei todos os pontos levantados em `src/utils/contratoPdf.ts`. A combinação atual `jsPDF.html() + unit:'px' + hotfix px_scaling + html2canvas scale:2 + container off-screen` é instável e gera os PDFs em branco / com texto fantasma. O fallback (`html2pdf`) já roda em `mm`, mas só é acionado quando o motor principal lança exceção — e o `jsPDF.html()` frequentemente "tem sucesso" produzindo um PDF vazio (não passa pelo catch).

Concordo com o plano de inverter a estratégia: **`html2pdf` como motor principal**, jsPDF apenas como fallback opcional.

### Outros problemas que encontrei na auditoria

1. **Validação de blob fraca** (linha 488): `blob.size < 2000` deixa passar PDFs em branco que pesam 2-10 KB (header A4 + página vazia já chega a esse tamanho). Vou trocar por validação real (contar páginas / verificar texto extraível via análise do tamanho relativo).
2. **`scale: 2` no html2pdf** (linha 516): o usuário sugeriu 1.5 e está correto — scale 2 com `unit:mm` força um upscale grande que esmaece bordas finas e torna o texto cinza claro em algumas impressoras/visualizadores.
3. **Reset CSS global `.lunari-pdf *`** força `background: transparent !important` em TUDO inclusive `<strong>`, `<table>`, etc — junto com `color: #000 !important` nos chips `<span class="contrato-var-auto">` (variáveis automáticas) os destruidores visuais ficam ok, mas o `border-color: #cccccc !important` aplicado a todo elemento interno gera linhas cinza fantasmas em parágrafos. Vou restringir o reset.
4. **Container em `left:-10000px`** (linha 411): em alguns navegadores (Safari/iOS) o html2canvas captura como tela vazia. Trocar para `left:0; top:0; opacity:0; pointer-events:none` posicionado atrás (`z-index:-1`) com `position:fixed` funciona melhor sem causar flash visual.
5. **Sem `pagebreak.before/avoid` configurado nos blocos chave** — assinaturas podem partir entre páginas mesmo com `page-break-inside:avoid` no CSS, porque html2pdf precisa do `mode:['css','legacy','avoid-all']` explícito.
6. **Variáveis ainda não substituídas no PDF**: o `conteudoHtml` recebido já vem com os spans `<span class="contrato-var-auto">…</span>` e `<span class="contrato-campo-editavel">…</span>` do editor. O `sanitizeContratoHtml` remove os atributos (ok) mas mantém o texto — então o conteúdo final está correto. Sem mudança aqui, só registrando que está validado.
7. **Fonte Arial pode falhar em ambientes Linux headless** — adicionar fallback de fonte na string `font-family` (já tem Helvetica, mas falta `sans-serif` final por algum motivo está ok). OK.

## Plano de correção

### Alteração 1 — Inverter ordem dos motores em `generateContratoPdf`

`src/utils/contratoPdf.ts` linhas 568-577:

```ts
// 1) Motor principal AGORA: html2pdf (mais estável com unit:mm)
try {
  return await generateViaHtml2Pdf(opts, innerHtml);
} catch (err) {
  warn('Motor principal (html2pdf) falhou, tentando fallback jsPDF.html:', err);
}
// 2) Fallback: jsPDF.html
return await generateViaJsPDF(opts, innerHtml);
```

### Alteração 2 — Reescrever `generateViaHtml2Pdf` com configuração estável

Mudanças:
- `scale: 1.5` (era 2)
- Margens em mm coerentes com A4: `[15, 15, 15, 15]`
- Adicionar `pagebreak: { mode: ['css', 'legacy', 'avoid-all'] }`
- Render em DOM real (não string) → permite que o CSS e fontes do navegador atuem antes da captura. Vai compartilhar o mesmo `createRenderContainer` que já existe.
- Validar blob com threshold mais sensato e via verificação do conteúdo do PDF (header `%PDF` + tamanho > 8 KB para 1 página de texto real).

### Alteração 3 — Refazer container de render (`createRenderContainer`)

Trocar:
```ts
root.style.position = 'fixed';
root.style.left = '-10000px';
root.style.top = '0';
root.style.width = '794px';
```

Por:
```ts
root.style.position = 'fixed';
root.style.left = '0';
root.style.top = '0';
root.style.width = '794px';
root.style.opacity = '0';
root.style.pointerEvents = 'none';
root.style.zIndex = '-1';
```

Mantém o nó dentro do viewport (html2canvas captura corretamente), invisível ao usuário.

### Alteração 4 — Suavizar reset CSS

No `PRINT_CSS` (linhas 152-275), substituir o bloco global por reset escopado mais cirúrgico:

```css
/* Reset apenas no container raiz (não nos descendentes) */
.lunari-pdf {
  background: #ffffff;
  color: #000000;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12.5px;
  line-height: 1.6;
  width: 794px;
  padding: 56px;
  box-sizing: border-box;
}
/* Reset cirúrgico: garante texto preto, mas NÃO força background nem border global */
.lunari-pdf * {
  box-sizing: border-box;
  color: #000000;
  text-shadow: none;
  filter: none;
}
.lunari-pdf span,
.lunari-pdf p,
.lunari-pdf div,
.lunari-pdf li,
.lunari-pdf h1,
.lunari-pdf h2,
.lunari-pdf h3 {
  background: transparent;
  border: none;
}
/* Restaura bordas onde realmente queremos */
.lunari-pdf .pdf-parte { border: 1px solid #cccccc; }
.lunari-pdf .pdf-header { border-bottom: 2px solid #000; }
.lunari-pdf .pdf-assinatura-linha { border-top: 1px solid #000; }
.lunari-pdf .pdf-footer { border-top: 1px solid #ddd; }
.lunari-pdf blockquote { border-left: 3px solid #ccc; }
```

### Alteração 5 — Validação de blob real

Substituir `blob.size < 2000` por uma checagem mais confiável:

```ts
async function isLikelyValidPdf(blob: Blob): Promise<boolean> {
  if (!blob || blob.size < 1500) return false;
  const head = await blob.slice(0, 5).text();
  if (!head.startsWith('%PDF-')) return false;
  // Heurística: PDF com texto real raramente tem < 6 KB para 1+ página
  return blob.size >= 4000;
}
```

E usar nas duas funções de geração — se reprovar, lança erro e cai no próximo motor.

### Alteração 6 — Atualizar `generateViaJsPDF` (fallback)

Quando vira fallback, mantém o código atual mas com:
- `unit: 'mm'` (não `px`)
- remover `hotfixes: ['px_scaling']`
- remover `width: 794` / `windowWidth: 794` da chamada `doc.html()`
- `scale: 1.5`

### Alteração 7 — Nada a mexer na UI

Os botões "Baixar PDF" em `ContratoViewerModal.tsx` e nos cards do Workflow já chamam `downloadContratoPdf` — funciona transparentemente.

## Validação obrigatória após implementação

1. Console do navegador: rodar `__testContratoPdfLayout()` → baixa PDF de teste e abrir.
2. Abrir um contrato real do cliente (ex.: o gerado para "Eduardo Valmor") e baixar PDF.
3. Verificar:
   - Texto preto nítido (não fantasma/cinza claro)
   - Cabeçalho com nome do cliente/fotógrafo
   - Cards de partes com bordas visíveis
   - Linhas de assinatura aparecendo
   - Paginação não corta título no meio
   - Variáveis substituídas (sem `{{xxx}}` no PDF)

## Arquivos a alterar

- `src/utils/contratoPdf.ts` — todas as 6 alterações listadas. Nenhum outro arquivo é afetado.

## Fora de escopo

- O HTML "minimalista" sugerido pelo usuário foi usado como inspiração (mm, scale 1.5, container visível com opacity), mas vamos preservar o layout completo atual (cabeçalho, partes, fechamento, assinaturas, rodapé) que está mais profissional. Se quiser layout simplificado depois, é uma segunda iteração.
