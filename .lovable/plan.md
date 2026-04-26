## Diagnóstico mais profundo

O conteúdo dos modelos prontos existe no código, mas há dois pontos diferentes no fluxo:

1. **Modelos prontos ainda não foram persistidos no banco**
   - A tabela `contrato_templates` tem hoje apenas 1 registro: `Contrato padrão de prestação de serviços`.
   - Esse registro tem conteúdo no banco (`conteudo_len = 1131`), então o banco não está totalmente vazio.
   - Os 4 modelos profissionais (`Casamento`, `Ensaio`, `Newborn`, `Evento`) existem apenas como seeds em `src/utils/contratoSeedTemplates.ts` até o usuário clicar, revisar e salvar.

2. **O editor continua sendo o ponto frágil**
   - O modal recebe `template.conteudo` ou `seedDraft.conteudo` corretamente no estado.
   - O conteúdo não aparece porque o `ContratoRichEditor` ainda depende do Tiptap para renderizar HTML dentro de um modal com montagem/desmontagem condicional.
   - O `setContent` agora está com assinatura v3 correta, mas o problema persiste na camada de renderização/sincronização do Tiptap, não na existência do texto.
   - Como o usuário precisa de confiabilidade para contratos, o editor de contrato não deve ficar dependente desse comportamento instável.

## Plano de correção

### 1. Substituir o editor de contrato por um editor HTML estável baseado em `contentEditable`
Trocar internamente o `ContratoRichEditor` para deixar de usar Tiptap e usar o mesmo padrão já estável do projeto nos editores de blog/tarefas:

- `div contentEditable` controlado por `ref`.
- Sincronização direta via `innerHTML` quando `value` muda.
- Sanitização com `DOMPurify` preservando tags necessárias para contrato: `h1`, `h2`, `h3`, `p`, `br`, `strong`, `em`, `u`, `ul`, `ol`, `li`, `blockquote`, `span`, `div`.
- Preservar `style` somente para casos necessários como espaçamento de assinatura (`margin-top`).
- Manter a mesma API atual do componente:
  - `value`
  - `onChange`
  - `editable`
  - `minHeight`
  - `placeholder`
  - `className`

Resultado: `ContratoTemplateEditorModal`, `NovoContratoModal` e `ContratoViewerModal` continuam usando o mesmo componente, mas sem o bug de renderização do Tiptap.

### 2. Manter a toolbar de edição rica
Recriar as ações atuais sem alterar a experiência:

- Negrito
- Itálico
- Sublinhado
- Título 1
- Título 2
- Lista com marcadores
- Lista numerada
- Citação
- Desfazer/refazer se viável via `document.execCommand('undo'/'redo')`

Também aplicar classes de visualização adequadas:

- Texto sempre visível em `text-foreground`.
- Headings com `text-foreground`.
- Parágrafos com boa leitura.
- `minHeight` real no container editável.
- Placeholder visual quando vazio.

### 3. Corrigir o modal para forçar remount correto por origem de conteúdo
No `ContratoTemplateEditorModal`, adicionar uma `key` no editor baseada na origem:

- `template-${template.id}` ao editar modelo salvo.
- `seed-${seedDraft.slug}` ao abrir modelo pronto.
- `new` ao criar do zero.

Isso elimina qualquer reaproveitamento indevido do editor entre um modelo vazio e outro com conteúdo.

### 4. Adicionar uma prévia simples de segurança abaixo/ao lado do editor
Adicionar um pequeno indicador no modal:

- Se houver conteúdo: mostrar contagem aproximada de caracteres e “Conteúdo carregado”.
- Se estiver vazio: mostrar aviso “Este modelo ainda não possui conteúdo”.

Isso ajuda a diferenciar:

- Conteúdo realmente vazio no banco.
- Conteúdo carregado, mas problema visual no editor.

### 5. Persistir automaticamente os 4 modelos profissionais se o usuário ainda não os tiver
Ajustar `ContratosConfig` para oferecer uma ação clara, e/ou no estado vazio permitir salvar todos:

- “Adicionar modelos profissionais” cria `Casamento`, `Ensaio`, `Newborn` e `Evento` com o conteúdo completo que você enviou.
- Evitar duplicados comparando `categoria`/`nome` antes de criar.
- Manter opção de editar e salvar qualquer modelo depois.

Importante: não vou apagar o modelo genérico existente sem confirmação. Posso apenas deixar os modelos profissionais disponíveis e editáveis.

### 6. Ajustar os templates para ficarem exatamente no conteúdo enviado
Remover acréscimos que não estavam no texto original, como linhas de cidade/data/assinatura adicionadas automaticamente ao final dos seeds.

Os modelos ficarão com:

- Título exatamente como enviado.
- Cláusulas 1 a 9 exatamente como enviadas.
- Variáveis no padrão solicitado:
  - `{{nome_cliente}}`
  - `{{cpf_cliente}}`
  - `{{nome_fotografo}}`
  - `{{data_sessao}}`
  - `{{horario_sessao}}`
  - `{{tipo_ensaio}}`
  - `{{valor_total}}`
  - `{{forma_pagamento}}`
  - `{{prazo_entrega}}`

### 7. Validar o fluxo completo após implementar
Validar os cenários:

1. Abrir o modelo salvo “Contrato padrão” para editar: conteúdo aparece no editor.
2. Abrir “Modelo pronto → Casamento”: conteúdo aparece imediatamente.
3. Salvar modelo pronto e reabrir: conteúdo continua aparecendo.
4. Criar contrato a partir de um modelo: conteúdo final é gerado e salvo independente do modelo.
5. Botão de salvar fica desabilitado apenas quando o conteúdo realmente estiver vazio.

## Arquivos a alterar

- `src/components/contratos/ContratoRichEditor.tsx`
  - Remover dependência prática de Tiptap neste componente e implementar editor `contentEditable` estável.

- `src/components/contratos/ContratoTemplateEditorModal.tsx`
  - Forçar remount do editor por `key`.
  - Adicionar indicador de conteúdo carregado/vazio.

- `src/components/configuracoes/ContratosConfig.tsx`
  - Melhorar ação para adicionar modelos prontos e, se necessário, adicionar todos de uma vez sem duplicar.

- `src/utils/contratoSeedTemplates.ts`
  - Ajustar conteúdo para ficar exatamente igual ao enviado, sem acréscimos de assinatura/cidade/data.

## Observação técnica

A correção anterior tentou estabilizar o Tiptap v3, mas como o problema continuou, a abordagem mais segura é remover Tiptap do fluxo de contratos. Contratos precisam de previsibilidade: se existe HTML no estado ou no banco, ele deve aparecer no modal sem depender de ciclo interno de editor externo.