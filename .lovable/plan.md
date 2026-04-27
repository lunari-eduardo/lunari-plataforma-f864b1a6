# Atualizar modelos de contrato profissionais

Vamos substituir os modelos seed atuais (4 modelos curtos) pelos **5 modelos profissionais completos** que você passou e expandir o sistema de variáveis para suportar todas as novas chaves usadas neles.

## O que você terá ao final

5 modelos prontos disponíveis em **Configurações → Contratos → "Modelo pronto"**:

1. **Ensaio Fotográfico** (Estúdio e Externas) — geral
2. **Ensaio Gestante** — com cláusulas de saúde, figurino e nascimento prematuro
3. **Casamento** — cobertura completa com sinal, multa e alimentação da equipe
4. **Newborn** — cláusulas vitais de segurança e higiene do bebê
5. **Eventos Gerais** (festas, corporativos, aniversários)

Todos com qualificação completa das partes (CPF/CNPJ, RG, cidade, estado, e-mail), foro, direitos autorais e cláusulas específicas de cada nicho.

## Novas variáveis suportadas

O sistema atual tem ~9 variáveis principais. Vamos adicionar **~25 novas** para cobrir todos os modelos:

**Cliente expandido:** `documento_cliente`, `cidade_cliente`, `estado_cliente`, `email_cliente`, `rg_cliente`, `nome_bebe`

**Fotógrafo expandido:** `documento_fotografo`, `cidade_fotografo`, `email_fotografo`

**Sessão/Evento:** `data_evento`, `local_evento`, `local_ensaio`, `horario_inicio`, `horario_termino`, `duracao_sessao`, `duracao_maxima`

**Comerciais (manuais):** `valor_sinal`, `valor_hora_extra`, `valor_foto_extra`, `taxa_deslocamento`, `valor_taxa_dano`, `descricao_forma_pagamento`, `quantidade_fotos`, `prazo_selecao`, `prazo_entrega_final`, `dias_aviso_previo`, `dias_multa_cancelamento`, `porcentagem_multa`, `fornecimento_figurino`

**Auto-preenchimento sempre que possível:**
- Dados do cliente vêm do CRM (nome, email, cidade, estado, CPF, endereço)
- Dados do fotógrafo vêm do perfil (nome, email, cidade)
- Dados de sessão vêm do workflow (data, hora, categoria, valor)

Variáveis sem valor disponível ficam destacadas em **amarelo `[nome_variavel]`** no PDF gerado, sinalizando ao fotógrafo o que precisa ajustar antes de enviar.

## Compatibilidade

- **Modelos antigos do usuário continuam funcionando** — todas as variáveis legado (`cliente_nome`, `sessao_data`, etc.) seguem suportadas em paralelo
- **Banco de dados não muda** — apenas o conteúdo dos seeds
- **Botão "Adicionar N modelos profissionais"** detecta automaticamente quais dos 5 ainda faltam na lista do usuário (via comparação de nome/categoria), permitindo adicionar só os novos sem duplicar

## Arquivos modificados

```text
src/utils/contratoSeedTemplates.ts     ← reescrito com 5 modelos completos em HTML
src/utils/contratoVariables.ts         ← adiciona ~25 variáveis novas + auto-fill
src/components/contratos/NovoContratoModal.tsx  ← carrega cidade/estado/CPF do cliente
                                                  e cidade do fotógrafo nas variáveis
```

## Detalhes técnicos

- Conteúdo dos modelos em HTML semântico (`<h2>`, `<h3>`, `<p>`, `<strong>`) compatível com o `ContratoRichEditor` e o gerador de PDF (`contratoPdf.ts`)
- `buildVariableMap` recebe novos campos opcionais do cliente (`cidade`, `estado`, `cpf`, `rg`) e do fotógrafo (`cidade`, `documento`) — leitura via `supabase.from('clientes').select('...')` e `useUserProfile`
- Variáveis puramente comerciais (sinal, multa, hora extra, etc.) ficam no grupo `manual` — são preservadas como `[placeholder]` se não preenchidas, para o fotógrafo editar inline antes de salvar o contrato
- Categorias dos seeds: `ensaio`, `gestante`, `casamento`, `newborn`, `evento` (a detecção de duplicatas usa essas categorias normalizadas)

## O que NÃO vamos fazer

- Não vamos criar uma UI nova para preencher manualmente cada variável comercial antes de gerar — o fluxo continua sendo: gerar contrato → editar inline no rich editor → salvar. Isso mantém a simplicidade do fluxo atual.
- Não vamos remover os modelos já criados pelos usuários no banco (apenas atualizamos o que aparece na lista de "modelos prontos disponíveis para adicionar").
