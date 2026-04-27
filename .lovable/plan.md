## Diagnóstico encontrado

O problema não parece estar no cadastro/salvamento principal do contrato, porque:

- `NovoContratoModal` gera `conteudoFinal` com `applyVariables(...)` e salva `conteudo` na tabela `contratos`.
- `useContratos` busca `conteudo` diretamente da tabela `contratos`.
- `ContratoViewerModal` reabre o contrato usando `contrato.conteudo`.
- O CRM (`ClienteContratosList`) baixa usando `c.conteudo` diretamente.

O ponto mais frágil está no gerador `src/utils/contratoPdf.ts`.

Causas prováveis identificadas no código atual:

1. O `ignoreElements` pode estar ignorando o próprio container clonado pelo `html2canvas`
   - O container recebe `data-pdf-render="true"`.
   - No clone interno do `html2canvas`, `el !== container` tende a ser verdadeiro porque o elemento é clonado.
   - Resultado possível: o elemento raiz do PDF é ignorado, gerando captura em branco.

2. O container está fora da área útil via `transform: translateY(-200vh)`
   - Mesmo visível, elementos transformados para fora podem ser rasterizados fora do canvas capturado.
   - Isso pode gerar PDF branco mesmo com HTML presente.

3. O fluxo atual usa `outputPdf('blob')` em vez de `.save()`
   - Outros PDFs do projeto usam `html2pdf().from(htmlString).save()` e funcionam em formato mais simples.
   - O contrato ficou com uma estratégia mais complexa e mais suscetível a bug.

4. A validação por tamanho do Blob não garante conteúdo visível
   - Um PDF pode ter cabeçalho/estrutura e passar de 3KB, mas ainda estar visualmente em branco.

## Plano de correção

### 1. Adicionar checkup completo antes da geração

Em `src/utils/contratoPdf.ts`, criar uma etapa de diagnóstico antes de converter:

- Logar `titulo`.
- Logar `conteudoHtml` recebido.
- Logar texto puro extraído.
- Logar placeholders restantes `{{...}}`.
- Logar HTML final montado para PDF.
- Logar dimensões reais do container quando usado.
- Logar `scrollWidth`, `scrollHeight`, `clientWidth`, `clientHeight`, `getBoundingClientRect()` e quantidade de caracteres.

Para evitar vazar contratos no console em produção, os logs completos ficarão ativos em ambiente de desenvolvimento/preview e também quando `localStorage.setItem('debugContratoPdf', '1')` estiver habilitado. Em caso de erro, o resumo técnico será logado sempre.

### 2. Corrigir a geração removendo as duas causas mais prováveis de branco

Refatorar `generateContratoPdf` para:

- Remover `data-pdf-render` do container capturado.
- Remover completamente `ignoreElements`.
- Não usar `transform`, `opacity`, `visibility:hidden` ou `display:none` no elemento de captura.
- Preferir passar um HTML string completo para `html2pdf().from(html).save()/outputPdf(...)`, seguindo o padrão dos outros PDFs do projeto.
- Se for necessário usar DOM real, posicionar o container de forma neutra, com `position: fixed; left: 0; top: 0; width: 794px`, sem transform, mantendo `pointer-events: none` e limpando logo após.

### 3. Criar fallback real: PDF mínimo e motor alternativo

Adicionar dois testes internos no gerador:

- Teste mínimo com HTML fixo: `Teste de PDF`.
- Se o contrato falhar mas o teste mínimo funcionar, o erro está no HTML/conteúdo.
- Se o teste mínimo falhar, o erro está no motor `html2pdf/html2canvas/jsPDF` ou no ambiente.

Implementar fallback de exportação:

1. Tentar geração normal com `html2pdf` usando HTML string completo.
2. Se falhar ou se as dimensões ficarem zeradas, tentar geração por DOM real sem transform.
3. Se ainda falhar, gerar erro claro para o usuário e console com diagnóstico.

### 4. Normalizar HTML do contrato antes do PDF

Ajustar a preparação do conteúdo para garantir HTML válido:

- Se vier texto puro sem tags, envolver em `<p>...</p>` preservando quebras de linha.
- Preservar tags válidas: `p`, `br`, `div`, `span`, `h1-h6`, `strong`, `b`, `em`, `i`, `u`, `ul`, `ol`, `li`, `blockquote`, `a`.
- Remover classes do editor (`contrato-var-auto`, `contrato-campo-editavel`) sem remover texto.
- Remover atributos problemáticos/event handlers.
- Forçar `color: #111827`, `background: #ffffff`, `font-family: Arial, Helvetica, sans-serif`.
- Garantir `white-space`/quebras compatíveis para parágrafos.

### 5. Ajustar layout profissional do PDF

Manter e reforçar:

- A4 retrato.
- Margens consistentes.
- Cabeçalho com título do contrato, fotógrafo/e-mail e data de emissão.
- Conteúdo com parágrafos justificados, espaçamento e headings legíveis.
- Listas com recuo.
- Rodapé discreto.

Também remover regras que possam causar branco ou quebra excessiva:

- Evitar `page-break-inside: avoid` em todos os `<p>`, pois contratos longos podem criar comportamento ruim de paginação.
- Usar quebras apenas em títulos/listas quando necessário.

### 6. Corrigir fluxo Workflow e CRM

Em `ContratoViewerModal`:

- Antes de baixar, se houver edição não salva, usar o estado atual do editor (`conteudo`) e logar isso.
- Adicionar indicador `Gerando PDF...` para evitar duplo clique.
- Em caso de erro, mostrar toast destrutivo com mensagem clara.

Em `ClienteContratosList`:

- Baixar sempre com `c.conteudo` do contrato listado.
- Logar ID/título/tamanho do conteúdo antes de chamar o gerador.
- Manter tratamento de erro.

### 7. Validação pós-correção

Depois da implementação:

- Rodar build/typecheck para garantir que não quebrou TypeScript.
- Fazer teste de geração com conteúdo fixo simples.
- Fazer teste com HTML real de contrato contendo:
  - `<h2>`/`<h3>`
  - `<p>`
  - `<br>`
  - `<ul><li>`
  - spans de variáveis automáticas/editáveis
  - placeholders restantes
- Confirmar nos logs:
  - conteúdo recebido não vazio
  - HTML final não vazio
  - dimensões do container maiores que zero
  - PDF gerado com tamanho plausível

## Arquivos a alterar

- `src/utils/contratoPdf.ts`
  - Refatoração principal, diagnóstico, HTML normalization, correção de container e fallback.

- `src/components/contratos/ContratoViewerModal.tsx`
  - Estado de geração, logs do fluxo modal, prevenção de duplo clique e erro claro.

- `src/components/contratos/ClienteContratosList.tsx`
  - Logs do fluxo CRM/lista e prevenção de erro silencioso.

## Resultado esperado

O PDF deixará de sair em branco e passará a ser gerado com:

- conteúdo completo do contrato;
- parágrafos e espaçamento corretos;
- cabeçalhos legíveis;
- dados preenchidos;
- cores forçadas para texto preto em fundo branco;
- diagnóstico claro no console caso algo volte a falhar.