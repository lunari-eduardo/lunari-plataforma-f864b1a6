Plano de correção para os PDFs de contratos

O problema não é só “cor do texto”: a geração atual passa um HTML completo como string para o `html2pdf`. Esse fluxo pode ser inserido dentro do DOM real da aplicação e herdar o tema ativo (`.dark`, `text-foreground`, variáveis CSS e estilos globais), especialmente porque `<html>`, `<head>` e `<body>` dentro de uma string não se comportam como um documento isolado. Isso explica o texto apagado no Dark Mode mesmo existindo CSS tentando forçar preto.

Vou corrigir a geração do PDF de contratos com os seguintes pontos:

1. Isolamento total do tema do app no PDF
- Trocar a estratégia de exportação para criar um container real e temporário de impressão com classe própria, por exemplo `.contrato-pdf-root`.
- Inserir esse container no DOM com:
  - fundo branco absoluto;
  - texto preto absoluto;
  - `color-scheme: light only`;
  - variáveis CSS locais sobrescrevendo `--foreground`, `--background`, `--muted-foreground`, etc.;
  - regra forte: `.contrato-pdf-root, .contrato-pdf-root * { color: #000 !important; opacity: 1 !important; }`.
- Evitar renderização com `opacity: 0`, pois isso pode gerar captura apagada/branca. O container ficará fora da área visível de forma segura ou visível temporariamente com dimensão A4 e sem interferir na UI.
- Garantir que classes do editor como `text-foreground`, `bg-background`, `contrato-var-auto` e `contrato-campo-editavel` não contaminem o PDF.

2. Estrutura A4 completa e profissional
- Substituir o cabeçalho atual por uma estrutura fixa:
  - título centralizado: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS`;
  - subtítulo com o nome/título específico do contrato;
  - data de emissão/geração;
  - dados resumidos de contratante e contratada(o), quando disponíveis.
- Criar layout com largura A4 previsível, margens internas e tipografia estável para PDF.
- No final, adicionar bloco de assinaturas com duas colunas:
  - linha sólida para CONTRATANTE;
  - linha sólida para CONTRATADA(O)/fotógrafo;
  - nome abaixo da linha quando disponível;
  - `page-break-inside: avoid` para evitar assinatura quebrada entre páginas.

3. Formatação correta do corpo do contrato
- Criar uma função de normalização/renderização do conteúdo antes do PDF:
  - se vier HTML do editor, sanitizar e manter tags básicas (`h2`, `h3`, `p`, `strong`, `ul`, `ol`, `li`, `br`);
  - se vier texto puro ou “HTML achatado”, transformar quebras de linha em parágrafos reais;
  - linhas que começam com cláusulas numeradas (`1.`, `2.`, `3.`, etc.) serão convertidas para título/linha em negrito;
  - preservar parágrafos com `text-align: justify` e espaçamento entre linhas.
- Corrigir o caso exibido no print, onde o texto aparece como uma massa contínua sem hierarquia visual.

4. Revisão do motor `html2pdf`
- Manter `html2pdf` como motor principal, mas passar um elemento DOM isolado, e não uma string com `<html><head><body>`.
- Ajustar opções para estabilidade:
  - `unit: 'mm'`;
  - `format: 'a4'`;
  - `backgroundColor: '#ffffff'`;
  - escala controlada, sem exagero;
  - remover qualquer dependência de cor herdada do tema.
- Depois do download, remover o container temporário e revogar URLs para evitar vazamentos de memória.

5. Fallback que nunca gera PDF em branco
- Manter e melhorar o fallback em `jsPDF` puro.
- O fallback também terá:
  - cabeçalho centralizado;
  - texto preto;
  - parágrafos com quebra de linha;
  - cláusulas numeradas em negrito;
  - assinaturas no final.
- Validar o PDF gerado pelo cabeçalho `%PDF-` e tamanho mínimo antes de entregar.

6. Ajustes nos pontos de chamada
- Revisar os dois locais que baixam contrato:
  - modal do contrato;
  - lista de contratos do cliente.
- Garantir que nome do cliente, fotógrafo, documento, e-mail e cidade cheguem corretamente ao gerador.
- Evitar usar cidade/endereço do cliente como local do evento/ensaio, mantendo a correção anterior.

7. Limpeza de toasts e comportamento visual
- Remover os success toasts restantes em contratos, quando forem CRUD simples, seguindo a regra do projeto de reduzir ruído visual.
- Manter apenas toasts de erro.

Critério de aceite
- Em Dark Mode, o PDF precisa sair com fundo branco e texto preto legível, sem opacidade baixa.
- O PDF precisa ter cabeçalho claro com o título `CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS` e data de geração.
- O corpo do contrato precisa respeitar quebras de linha, parágrafos e títulos de cláusulas.
- O PDF precisa ter campos de assinatura para cliente e fotógrafo no final.
- A geração não pode resultar em PDF branco.
- As variáveis de local do evento/ensaio não devem voltar a puxar endereço do cliente.