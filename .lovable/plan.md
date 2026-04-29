Do I know what the issue is? Sim.

O problema dos contratos não foi corrigido antes porque a etapa sobre variáveis/modelos ficou como plano e não houve implementação dela; a aprovação posterior executou apenas o plano do PDF. Na prática, os arquivos de variáveis e modelos ainda estão com os mesmos pontos que você marcou nas imagens.

O problema do PDF também está identificado: a função de contrato foi alterada, mas continua renderizando um DOM oculto com `opacity: 0` e `z-index: -1`. Como html2canvas captura o estado visual real do elemento, isso pode gerar uma imagem transparente/branca. O PDF financeiro funciona porque usa outro padrão: monta um HTML completo/string e entrega direto para `html2pdf`, sem depender de um nó invisível no DOM.

Plano de correção obrigatória

1. Corrigir a origem das variáveis de contrato
- Em `src/utils/contratoVariables.ts`:
  - Remover definitivamente o fallback de `local_ensaio` e `local_evento` para `cliente.endereco`.
  - Manter compatibilidade técnica com contratos antigos, mas essas variáveis não vão mais puxar endereço do cliente.
  - Ajustar defaults editáveis para valores sem unidade:
    - `duracao_sessao`: `2`, não `2 horas`
    - `duracao_maxima`: `4`, não `4 horas`
    - `quantidade_fotos`: `20`, não `20 fotos tratadas`
    - `prazo_entrega`, `prazo_entrega_final`, `prazo_selecao`: números puros, não `30 dias úteis`
  - Criar uma normalização por tipo de variável para impedir duplicação mesmo se algum valor antigo/manual vier com unidade. Exemplo:
    - `2 horas` vira `2` antes de entrar em `{{duracao_sessao}} horas`
    - `20 fotos tratadas` vira `20` antes de entrar em `{{quantidade_fotos}} fotografias tratadas`
    - `30 dias úteis` vira `30` antes de entrar em `{{prazo_entrega}} dias úteis`

2. Remover “Local do Ensaio/Evento” dos modelos padrão
- Em `src/utils/contratoSeedTemplates.ts`, revisar os 5 modelos padrão:
  - Ensaio Fotográfico
  - Ensaio Gestante
  - Casamento
  - Newborn
  - Eventos
- Remover as linhas/cláusulas com:
  - `Local do Ensaio: {{local_ensaio}}`
  - `Local do Evento: {{local_evento}}`
- Ajustar títulos de cláusulas para não prometer local quando o modelo não define local. Exemplo: “Do objeto, data e local” vira “Do objeto e data”.
- Revisar cada trecho onde a variável recebe unidade no texto para garantir que não haverá frases como:
  - `2 horas horas`
  - `20 fotos tratadas fotos tratadas`
  - `30 dias úteis dias úteis`
- Corrigir também inconsistências textuais encontradas durante a revisão, especialmente cláusulas de sinal/reserva em casamento e newborn para explicitar `{{valor_sinal}}` quando aplicável.

3. Garantir que modelos já existentes do usuário também sejam corrigidos
Apenas alterar os seeds não corrige automaticamente modelos já salvos no banco. Por isso a correção precisa cobrir os dois cenários:
- Novos modelos criados a partir dos padrões: virão corrigidos.
- Modelos padrão já salvos no Supabase: serão normalizados ao carregar/usar, removendo as linhas de local e evitando unidades duplicadas.

Implementação prevista:
- Criar uma função utilitária de saneamento de conteúdo de template, aplicada quando os templates são carregados e antes de gerar um contrato.
- Essa função será conservadora: corrige apenas padrões conhecidos dos modelos do sistema, sem destruir textos personalizados do usuário.
- Contratos já assinados/permanentes não serão apagados nem reescritos automaticamente; a correção mira modelos e novos rascunhos gerados.

4. Refatorar completamente o PDF de contrato usando o padrão que funciona no financeiro
- Em `src/utils/contratoPdf.ts`, remover a arquitetura atual baseada em:
  - criar container no DOM
  - `opacity: 0`
  - `z-index: -1`
  - `windowWidth: 794`
  - `jsPDF.html()` como fallback visual
- Substituir por uma arquitetura similar ao financeiro:
  - montar um HTML completo e isolado: `<!doctype html><html><head><style>...</style></head><body>...</body></html>`
  - passar esse HTML string diretamente para `html2pdf().set(options).from(html).outputPdf('blob')`
  - usar CSS inline/escopado com fundo branco e texto preto
  - não depender do tema dark do editor
  - não renderizar elemento oculto no viewport
- Usar opções de PDF simples e estáveis:
  - `jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait', compress: true }`
  - `html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', letterRendering: true, logging: false }`
  - sem `width`, sem `windowWidth`, sem `px_scaling`

5. Criar fallback real que nunca gere PDF branco
- O fallback não será mais `jsPDF.html()`, porque ele também depende de html2canvas.
- Se o `html2pdf` falhar, gerar um PDF simplificado via jsPDF puro:
  - extrair texto limpo do contrato
  - quebrar linhas com `splitTextToSize`
  - desenhar título, metadados, corpo e assinaturas página por página
- Esse fallback perde parte da formatação rica, mas garante o mais importante: nunca entregar PDF branco para o usuário.

6. Melhorar testes e diagnóstico
- Manter e revisar:
  - `window.__testContratoPdf()`
  - `window.__testContratoPdfLayout()`
- Adicionar logs úteis somente em preview/dev:
  - tamanho do HTML final
  - tamanho do texto puro
  - motor usado: `html2pdf-string` ou `jspdf-text-fallback`
  - tamanho final do blob
- Critério de aceite técnico:
  - teste mínimo baixa PDF com texto visível
  - teste de layout baixa PDF com títulos, parágrafos, lista e assinaturas
  - contrato real com seus modelos não mostra local do cliente como local do ensaio/evento
  - não aparecem duplicações de unidade nos trechos de duração, fotos e prazos

7. Limpar notificações indevidas encontradas no fluxo
- Os hooks de contratos/modelos ainda exibem toasts de sucesso em CRUD, contrariando a memória do projeto: “No success toasts for CRUD actions”.
- Vou remover os toasts de sucesso nesses hooks e manter apenas erros, sem alterar a lógica principal.

Arquivos a alterar
- `src/utils/contratoVariables.ts`
- `src/utils/contratoSeedTemplates.ts`
- `src/utils/contratoPdf.ts`
- `src/hooks/useContratoTemplates.ts`
- `src/components/contratos/NovoContratoModal.tsx`
- Possivelmente `src/components/contratos/ContratoTemplateEditorModal.tsx` para esconder/remover as variáveis de local da lista de inserção.

Critério de aceite final
- “Local do Ensaio/Evento” não aparece mais nos modelos padrão do sistema.
- Nenhuma variável de local puxa endereço do cliente.
- Duração, quantidade de fotos e prazos não duplicam unidades.
- Todos os modelos padrão são revisados.
- PDF de contrato deixa de usar renderização oculta e passa a usar HTML string como o financeiro.
- Se o motor visual falhar, um PDF textual válido é gerado em fallback em vez de PDF branco.

<lov-actions>
<lov-open-history>View History</lov-open-history>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>