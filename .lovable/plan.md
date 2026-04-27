## Diagnóstico confirmado

Pelas imagens anexadas, o PDF não está mais totalmente vazio: o conteúdo existe, mas está quase invisível. Isso muda a causa raiz principal:

1. O problema atual é principalmente contraste/CSS: o texto está sendo renderizado com cor muito clara, provavelmente herdada de estilos do editor/tema ou de estilos inline preservados.
2. A estratégia atual ainda depende de `html2pdf/html2canvas`, que rasteriza o HTML como imagem e é sensível a tema dark, estilos herdados, `line-height`, canvas grande e paginação.
3. O layout atual do PDF ainda está frágil: não tem estrutura contratual completa com capa/cabeçalho forte, dados das partes em blocos, rodapé/assinaturas e paginação previsível.
4. A validação por tamanho do Blob não detecta o erro visual, porque um PDF com texto quase branco pode ter tamanho normal.
5. O contrato salvo contém spans e possivelmente estilos vindos do editor (`style`, `class`, `data-campo`), e a limpeza atual remove apenas algumas cores específicas, não neutraliza todo CSS herdado/inline.

## Correção definitiva proposta

### 1. Parar de usar o layout da tela para o PDF

Refatorar `src/utils/contratoPdf.ts` para gerar um documento de impressão totalmente isolado:

- HTML próprio para PDF, sem classes Tailwind, sem variáveis CSS do app e sem dependência do tema dark/light.
- Fundo branco absoluto.
- Texto preto absoluto (`#000000`) em todos os elementos do contrato.
- Fonte segura: Arial, Helvetica, sans-serif.
- Largura A4 e margens internas padronizadas.
- CSS de impressão com reset agressivo dentro do container do PDF.

### 2. Trocar o motor principal para `jsPDF.html()` com DOM real isolado

Substituir o fluxo principal atual de `html2pdf().from(htmlString).outputPdf('blob')` por renderização direta com `jsPDF.html()`:

- Criar um container DOM real, visível para renderização, fora da tela sem `opacity: 0`, sem `visibility:hidden`, sem `display:none` e sem `transform`.
- Definir largura fixa em pixels compatível com A4.
- Forçar dimensões e estilos antes de renderizar.
- Aguardar fontes/layout com `document.fonts.ready` e dois `requestAnimationFrame`.
- Gerar Blob via `doc.output('blob')`.

O `html2pdf` ficará apenas como fallback temporário se o ambiente não suportar a renderização principal.

### 3. Neutralizar completamente estilos problemáticos do editor

Reescrever a normalização do conteúdo para:

- Sanitizar HTML com lista de tags permitidas.
- Remover todos os atributos `style` do conteúdo do contrato, não apenas cores brancas.
- Remover classes do editor e quaisquer classes herdadas.
- Remover atributos `data-*`, handlers `on*`, `contenteditable`, `spellcheck` etc.
- Preservar texto, parágrafos, títulos, listas, negrito, itálico, sublinhado e quebras.
- Converter texto puro em parágrafos válidos.
- Transformar `div` soltos em blocos seguros quando necessário.
- Detectar placeholders `{{...}}` restantes e logar no diagnóstico.

Isso elimina a causa mais provável do contraste quase branco: estilos inline/classes herdadas escapando para o PDF.

### 4. Criar layout contratual completo

O PDF será montado com esta estrutura fixa:

```text
[Topo do documento]
CONTRATO
Título do contrato
Cliente | Fotógrafo | Data de emissão

[Duas caixas de identificação]
Contratante: nome/e-mail/documento quando disponível
Contratada(o): nome/e-mail/documento quando disponível

[Corpo]
Conteúdo do contrato com headings, parágrafos, listas e espaçamento corretos

[Fechamento]
Local e data

[Assinaturas]
______________________________
Nome do cliente
CONTRATANTE

______________________________
Nome do fotógrafo
CONTRATADA(O)

[Rodapé]
Gerado por Lunari + data
```

### 5. Enriquecer os dados passados ao gerador

Atualizar chamadas no Workflow/modal e CRM para enviar metadados quando disponíveis:

- nome do cliente (`contrato.cliente?.nome` ou prop/lista);
- e-mail do cliente;
- nome/e-mail do fotógrafo;
- data de emissão;
- local/data do contrato via `variaveis_snapshot` quando existir (`cidade_atual`, `cidade_fotografo`, `data_atual`).

Se algum dado estiver ausente, o PDF usará placeholders profissionais como linhas em branco, sem quebrar layout.

### 6. Corrigir paginação e corte no final

Adicionar regras específicas para evitar cortes:

- `page-break-inside: avoid` apenas em blocos pequenos e assinatura, não em todos os parágrafos longos.
- Títulos com `page-break-after: avoid`.
- Área de assinatura com `page-break-inside: avoid` e espaço antes.
- Margens inferiores suficientes.
- Remover `height` fixa do canvas/PDF e deixar o render calcular altura.
- Controlar `autoPaging` no `jsPDF.html()` para quebrar texto automaticamente.

### 7. Diagnóstico definitivo no console

Manter e ampliar logs de debug (`localStorage.setItem('debugContratoPdf','1')`):

- conteúdo recebido;
- texto puro extraído;
- placeholders restantes;
- HTML sanitizado;
- HTML final do PDF;
- dimensões do container (`scrollWidth`, `scrollHeight`, `clientWidth`, `clientHeight`, `getBoundingClientRect()`);
- cor computada real dos primeiros parágrafos antes de gerar;
- tamanho final do Blob.

Adicionar uma validação visual programática mínima antes de gerar:

- se `getComputedStyle(container).color` ou dos parágrafos não for preto/escuro, abortar e corrigir forçando estilos inline no container.
- se dimensões forem zero, abortar com erro claro.

### 8. Testes internos de geração

Adicionar funções de teste em modo debug no `window`:

- `window.__testContratoPdf()` gera PDF mínimo “Teste PDF”.
- `window.__testContratoPdfLayout()` gera contrato de exemplo com título, parágrafos, lista e assinaturas.
- `window.__debugContratoPdfHtml()` retorna/mostra o HTML final sanitizado para inspeção.

### 9. Ajustes nos fluxos Workflow e CRM

Em `ContratoViewerModal.tsx`:

- Usar o conteúdo atual do editor, inclusive edição não salva.
- Bloquear duplo clique com estado `Gerando...`.
- Enviar metadados do cliente e snapshot para o PDF.
- Exibir erro claro caso o PDF não consiga ser gerado.

Em `ClienteContratosList.tsx`:

- Adicionar estado por contrato para impedir múltiplos downloads simultâneos.
- Enviar nome/e-mail do cliente do contrato listado.
- Manter logs de diagnóstico.

### 10. Remover ruído de toast de sucesso onde não for necessário

Manter apenas toasts de erro para geração de PDF, respeitando a preferência do projeto de evitar notificações de sucesso em ações CRUD/rotineiras.

## Arquivos a alterar

- `src/utils/contratoPdf.ts`
  - Refatoração principal do motor, normalização, layout A4, assinatura, diagnóstico e fallback.

- `src/components/contratos/ContratoViewerModal.tsx`
  - Passar metadados completos e manter estado de geração.

- `src/components/contratos/ClienteContratosList.tsx`
  - Passar metadados completos e adicionar trava de download por contrato.

- `src/types/contrato.ts`
  - Expandir tipagem opcional do `cliente` se necessário para incluir e-mail/documentos já retornados pelo hook.

- `src/hooks/useContratos.ts`
  - Ajustar `select` para trazer dados úteis do cliente caso falte algum campo permitido.

## Validação após implementar

1. Rodar build/typecheck.
2. Gerar teste mínimo.
3. Gerar teste de layout completo.
4. Gerar contrato real com o conteúdo do modelo de gestante mostrado nas imagens.
5. Confirmar no console:
   - conteúdo recebido não está vazio;
   - HTML final possui texto;
   - container tem largura/altura reais;
   - cor computada do texto é preta/escura;
   - Blob final tem tamanho plausível.
6. Confirmar visualmente no preview que o PDF tem:
   - texto preto legível;
   - fundo branco;
   - cabeçalho estruturado;
   - margens A4;
   - parágrafos e títulos espaçados;
   - assinatura e rodapé;
   - sem corte no final.

## Resultado esperado

O PDF de contratos deixará de depender do tema visual do sistema e será renderizado como documento profissional de impressão, com contraste correto, estrutura contratual completa, quebra de página previsível, cabeçalho, rodapé e assinaturas.