Plano para corrigir definitivamente o PDF em branco dos contratos

Diagnóstico confirmado

- O PDF anexado realmente está vazio: ele tem apenas 1 página A4 branca e praticamente nenhum conteúdo desenhado.
- A correção anterior atacou causas comuns do `html2canvas`, mas deixou passar um ponto crítico: o container temporário está com `opacity: 0`.
- Como `html2pdf.js` renderiza o DOM via `html2canvas`, `opacity: 0` pode ser respeitado na captura. Resultado: ele captura exatamente uma página branca.
- Também há outro risco importante: contratos longos renderizados como um único canvas podem bater no limite máximo de canvas do navegador e sair completamente brancos. Esse problema é documentado pelo próprio `html2pdf.js`.

O que será alterado

1. Corrigir a causa direta do PDF branco
- Em `src/utils/contratoPdf.ts`, remover o uso de `opacity: 0` no elemento usado para captura.
- Substituir por uma técnica segura:
  - container renderizado normalmente, com texto visível para o motor de captura;
  - fora da área visível do usuário, mas sem `opacity: 0`, sem `display: none` e sem `visibility: hidden`;
  - largura explícita de A4;
  - fundo branco explícito;
  - isolamento visual para não interferir no app.

2. Trocar o fluxo de geração para uma versão mais robusta
- Usar HTML completo como fonte de geração (`from(htmlString)`) ou um container clonado sem transparência, evitando capturar o próprio wrapper invisível.
- Manter CSS totalmente independente do tema do app, com cores fixas e tipografia segura.
- Configurar `html2canvas` com:
  - `backgroundColor: '#ffffff'`
  - `windowWidth` coerente com o A4 em pixels
  - `scale` controlado para reduzir risco de limite de canvas
  - logging opcional apenas em ambiente de desenvolvimento

3. Reduzir risco de canvas gigante em contratos longos
- Diminuir o `scale` de 2 para um valor seguro quando o conteúdo for grande.
- Adicionar proteção por altura estimada: se o conteúdo for longo, usar uma escala menor para evitar PDF branco por limite de canvas.
- Evitar configurações de pagebreak que empurrem blocos inteiros para fora da página.

4. Normalizar HTML do contrato antes do PDF
- Melhorar `neutralizarEstilosEditor` para lidar com spans que tenham múltiplos atributos, por exemplo:
  - `<span class="contrato-var-auto" data-campo="...">`
  - `<span data-campo="..." class="contrato-campo-editavel">`
- Remover classes visuais do editor, mas preservar o texto digitado pelo usuário.
- Garantir que tags usadas pelo editor (`p`, `br`, `h2`, `h3`, `ul`, `ol`, `li`, `strong`, `em`, `span`) tenham estilo definido no PDF.

5. Melhorar o layout final do contrato
- Cabeçalho com título do contrato, fotógrafo/e-mail e data de emissão.
- Corpo com parágrafos justificados, espaçamento consistente e títulos bem definidos.
- Margens A4 profissionais.
- Rodapé discreto.
- Quebra de página mais previsível para contratos longos.

6. Corrigir comportamento nos dois pontos de entrada
- Manter um único utilitário `downloadContratoPdf` usado por:
  - modal do contrato aberto pelo Workflow;
  - lista/modal de contratos no CRM.
- Como ambos usam o mesmo utilitário, a correção será centralizada e vale para os dois fluxos.

7. Adicionar validações e fallback de erro
- Antes de gerar, validar se `conteudoHtml` não está vazio depois de remover tags.
- Se a geração produzir um Blob suspeito/muito pequeno, exibir erro claro em vez de baixar PDF branco.
- Adicionar tratamento visual de erro no botão de baixar PDF para o usuário saber que a geração falhou.

Arquivos previstos

- `src/utils/contratoPdf.ts`
  - refatorar a estratégia de renderização;
  - remover `opacity: 0`;
  - adicionar normalização robusta de HTML;
  - adicionar proteção contra canvas gigante;
  - adicionar validação de Blob.

- `src/components/contratos/ContratoViewerModal.tsx`
  - envolver download em `try/catch` e mostrar toast de erro.

- `src/components/contratos/ClienteContratosList.tsx`
  - envolver download em `try/catch` e mostrar toast de erro no fluxo do CRM.

Resultado esperado

- O PDF deixará de sair branco.
- Contratos gerados pelo Workflow e pelo CRM sairão com:
  - cabeçalho;
  - título;
  - dados preenchidos;
  - parágrafos e espaçamento corretos;
  - campos editáveis convertidos em texto limpo;
  - quebras de página naturais para contratos longos.