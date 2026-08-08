# Motor de Contexto para IA de Orçamentos e Propostas — Lunari

**Documento de arquitetura e especificação funcional**
**Versão:** 1.0 · **Status:** Fundação arquitetural — pronto para implementação de estrutura (não de IA)
**Escopo:** Modelo de dados, camadas de contexto, motor de regras, contrato responsivo e arquitetura de componentes. Não inclui integração com provedor de IA.

---

## Sumário

0. Resumo executivo
1. Visão geral da arquitetura
2. Objetivos
3. Princípios fundamentais
4. Context Model — visão geral e hierarquia
5. Business Context (identidade comercial)
6. Brand Context (identidade de marca)
7. Audience Context (público)
8. Sales Strategy Context (estratégia de venda) + catálogo de estratégias
9. Client Context
10. Quote Context
11. Design Context (preferências estéticas)
12. Responsive Layout Contract
13. Component Architecture (anti-alucinação de HTML)
14. As três camadas: Conteúdo, Estratégia, Apresentação
15. Motor de regras (obrigatórias, recomendadas, preferências, liberdade criativa)
16. Hierarquia de prioridade e resolução de conflitos
17. Regras anti-alucinação
18. Modelo de dados (entidades para Supabase)
19. Estrutura de contexto para a futura API
20. Fluxo de geração de proposta
21. Fluxo de revisão / iteração
22. Fluxo de personalização por cliente
23. Editor futuro — representação estruturada
24. Exemplos práticos
25. Casos extremos e regras de fallback
26. Recomendações de implementação no backend
27. Recomendação de estrutura Supabase
28. Estratégia de versionamento
29. Checklist de aceite
30. Decisões arquiteturais recomendadas
31. O que NÃO deve ser implementado agora
32. Referências consultadas

---

## 0. Resumo executivo

Este documento define a **fundação estrutural** sobre a qual, futuramente, uma IA irá operar para gerar propostas comerciais personalizadas para fotógrafos dentro do Lunari. Ele **não** implementa a IA, **não** escolhe provedor, e **não** define prompts de produção — define o **ambiente** em que qualquer IA (hoje ou daqui a dois anos, com qualquer provedor) deverá operar.

A ideia central, validada pela pesquisa técnica realizada (seção 32), é a mesma que sustenta os sistemas de "generative UI" mais maduros do mercado: a IA nunca deve ter liberdade para escrever HTML/CSS/JSON arbitrário. Ela deve **selecionar e configurar** peças de um catálogo conhecido (componentes, tokens de design, blocos de conteúdo), dentro de regras técnicas que o sistema garante. Essa abordagem é chamada na literatura de **"bounded generation"** ou **"declarative generative UI"**: a IA tem liberdade de composição, mas não liberdade de invenção estrutural. É exatamente o equilíbrio que a Lunari pediu: **regras técnicas rígidas + contexto comercial estruturado + liberdade criativa**.

A segunda ideia central é a de **grounding**: toda alucinação de fatos (preços, serviços, nomes, políticas) é combatida injetando os dados reais do sistema como contexto de leitura obrigatória, e instruindo o modelo a nunca preencher lacunas com suposições — apenas usar o que foi fornecido, sinalizar o que falta, ou perguntar.

O papel do Lunari é ser **dono das regras, dos dados e das capacidades**. O papel da IA é **interpretar, decidir dentro dos limites e compor**.

---

## 1. Visão geral da arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│                         LUNARI BACKEND                            │
│                                                                    │
│  ┌────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │  Dados      │   │  Context      │   │  Rules Engine          │  │
│  │  reais      │──▶│  Assembler    │──▶│  (obrigatório/         │  │
│  │  (Supabase) │   │  (monta o     │   │   recomendado/         │  │
│  │             │   │   payload)    │   │   preferência)         │  │
│  └────────────┘   └──────────────┘   └────────────────────────┘  │
│         │                  │                      │               │
│         ▼                  ▼                      ▼               │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │         AI CONTEXT PAYLOAD (versionado, imutável)          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                            │                                      │
│                            ▼  (fase futura — não implementar agora)│
│                  ┌───────────────────┐                            │
│                  │  Provedor de IA    │                           │
│                  │  (agnóstico)       │                           │
│                  └───────────────────┘                            │
│                            │                                      │
│                            ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │   VALIDATION GATE (schema JSON + Layout Contract +        │    │
│  │   verificação de alucinação + registro de auditoria)       │    │
│  └──────────────────────────────────────────────────────────┘    │
│                            │                                      │
│                            ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │   PROPOSTA ESTRUTURADA (component tree em JSON)            │    │
│  │   → consumida pelo Editor / Renderer                       │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

Nada nesta arquitetura depende de um provedor específico de IA. O que muda quando trocarmos de modelo é apenas a etapa "Provedor de IA" — todo o resto (dados, regras, validação, versionamento) é propriedade do Lunari e permanece estável.

---

## 2. Objetivos

1. Permitir que a IA gere propostas que pareçam **feitas sob medida** para cada fotógrafo e cada cliente — sem inventar fatos.
2. Separar claramente **o que é dado real**, **o que é preferência configurável** e **o que é regra técnica inegociável**.
3. Garantir que qualquer proposta gerada funcione em qualquer dispositivo, sem depender da "sorte" da geração.
4. Criar uma base de dados extensível, que suporte novas capacidades de IA (revisão, aprendizado, follow-up automático) sem retrabalho estrutural.
5. Tornar o processo auditável: para toda proposta gerada, deve ser possível reconstruir exatamente qual contexto foi usado.

---

## 3. Princípios fundamentais

| # | Princípio | O que significa na prática |
|---|---|---|
| P1 | **A IA nunca inventa estrutura** | Ela escolhe entre componentes conhecidos (seção 13), nunca escreve HTML/CSS/JS livre. |
| P2 | **A IA nunca inventa fatos** | Preço, serviço, nome, condição comercial só existem se vierem do banco de dados real. |
| P3 | **Regra técnica > preferência estética** | Layout Contract nunca é sobrescrito por um pedido de estilo. |
| P4 | **Contexto tem hierarquia, não é uma sopa de informações** | Ver seção 16 — em conflito, sempre se sabe quem vence. |
| P5 | **Liberdade criativa existe, mas é o último recurso** | A IA só "decide livremente" no que sobra depois de aplicadas todas as regras e preferências configuradas. |
| P6 | **Toda geração é auditável e reproduzível** | O payload de contexto enviado é congelado e versionado junto com o resultado. |
| P7 | **O sistema é agnóstico de provedor de IA** | Nenhuma regra de negócio deve depender de peculiaridades de um modelo específico. |
| P8 | **Especificidade de estilo é dados, não é template fixo** | Não existe uma lista fechada "Minimalista/Infantil/Editorial" que trava o sistema — existe um conjunto de atributos de design interpretáveis (seção 11). |

Esses princípios são consistentes com o que a pesquisa de mercado mostra como padrão emergente para sistemas de "generative UI" de produção: interfaces geradas por IA that são confiáveis usam um **catálogo fechado de componentes** (não HTML livre) e um **contrato de dados** que separa autoridade do sistema, dados recuperados, instruções da sessão e criatividade do modelo — exatamente a divisão que estruturamos nas seções seguintes.

---

## 4. Context Model — visão geral e hierarquia

Em vez de nomear os contextos exatamente como no rascunho inicial, propomos nomes que deixam explícito **quem é dono de cada informação** e **com que frequência ela muda**:

| Contexto | Quem preenche | Frequência de mudança | Onde vive |
|---|---|---|---|
| `SYSTEM_RULES` | Lunari (engenharia) | Raríssima — versão de produto | Config do sistema, não editável pelo fotógrafo |
| `LAYOUT_CONTRACT` | Lunari (engenharia/design) | Raríssima | Config do sistema |
| `COMPONENT_REGISTRY` | Lunari (engenharia/design) | Baixa — a cada release | Config do sistema |
| `BUSINESS_CONTEXT` | Fotógrafo | Baixa | Comercial → Estratégia |
| `BRAND_CONTEXT` | Fotógrafo | Baixa | Comercial → Marca (ou Configurações) |
| `AUDIENCE_CONTEXT` | Fotógrafo | Baixa/média | Comercial → Estratégia → Público |
| `SALES_STRATEGY_CONTEXT` | Fotógrafo (seleciona do catálogo) | Baixa/média | Comercial → Estratégia |
| `DESIGN_PREFERENCES` | Fotógrafo | Média | Comercial → Estratégia → Estilo, com override por proposta |
| `CLIENT_CONTEXT` | Sistema (dados reais) + Fotógrafo (observações) | Alta — por cliente | CRM / Clientes |
| `QUOTE_CONTEXT` | Sistema + Fotógrafo | Alta — por proposta | Módulo de Orçamentos |
| `SESSION_INSTRUCTIONS` | Fotógrafo, no momento do pedido | Efêmera | Não persiste como config — persiste como log da geração |

**Regra de ouro:** os quatro primeiros contextos (`SYSTEM_RULES`, `LAYOUT_CONTRACT`, `COMPONENT_REGISTRY`) **nunca são editáveis pelo fotógrafo**. Eles são a fronteira de segurança técnica do produto. Tudo o mais é configurável — em graus diferentes de liberdade (ver seção 15).

---

## 5. Business Context — identidade comercial

Preenchido em **Comercial → Estratégia → Identidade Comercial**.

| Campo | Tipo | Obrigatório | Observações |
|---|---|---|---|
| `positioning_statement` | texto curto | Recomendado | Ex.: "Fotografia de casamento premium para casais que valorizam narrativa autoral." |
| `value_proposition` | texto | Recomendado | O que o cliente ganha que a concorrência não oferece. |
| `differentiators` | lista de texto | Opcional | 3–6 diferenciais concretos. |
| `desired_perception` | enum + texto livre | Opcional | Ex.: `premium`, `acessível`, `artístico`, `técnico`, `boutique` — com campo livre para nuance. |
| `exclusivity_level` | escala 1–5 | Opcional | Influencia tom (ver seção 8) e densidade visual (ver seção 11). |
| `ideal_client_profile` | texto | Recomendado | Descrição livre do cliente ideal (complementa `AUDIENCE_CONTEXT`). |
| `ticket_range` | enum (`entrada`, `intermediário`, `alto`, `luxo`) + valores opcionais | Recomendado | Nunca usado para *inventar* preço — apenas para calibrar tom. |
| `experience_type` | texto/lista | Opcional | Ex.: "ensaio guiado", "documentação não-posada", "estúdio completo com styling". |

**Uso pela IA:** calibra tom, vocabulário e nível de "venda" vs. "constatação de fato" no texto gerado. **Nunca** é usado para gerar números ou condições comerciais — isso vem exclusivamente do catálogo de serviços real (seção 9/18).

---

## 6. Brand Context — identidade de marca

| Campo | Tipo | Observações |
|---|---|---|
| `brand_name` | texto | Nome comercial exibido. |
| `tone_of_voice` | enum múltiplo | Ex.: `formal`, `caloroso`, `direto`, `poético`, `bem-humorado`. |
| `preferred_vocabulary` | lista de palavras/expressões | Termos que o fotógrafo gosta de usar. |
| `forbidden_words` | lista de palavras/expressões | Termos que a IA nunca deve usar (regra obrigatória, não sugestão). |
| `formality_level` | escala 1–5 | 1 = muito informal, 5 = muito formal. |
| `logo_asset_id` | referência de arquivo | Usado pelo componente de capa/rodapé, nunca inventado. |
| `color_tokens` | objeto de tokens (ver seção 13) | Cores de marca — viram tokens, não valores CSS soltos. |
| `typography_tokens` | objeto de tokens | Fontes de marca, se houver contrato de licença configurado. |
| `visual_references` | lista de imagens/moodboard | Contexto interpretativo, não literal. |

**Uso pela IA:** define o "sotaque" da proposta. `forbidden_words` é regra obrigatória (seção 15); todo o resto é preferência forte.

---

## 7. Audience Context — público

Este não é um "persona" estático de marketing — é **contexto comercial acionável**. Pode existir mais de um `AUDIENCE_CONTEXT` por fotógrafo (ex.: "casais para casamento" e "famílias para ensaio newborn"), e cada proposta escolhe (ou herda) qual perfil de público está em jogo.

| Campo | Tipo | Observações |
|---|---|---|
| `segment_name` | texto | Rótulo interno, ex.: "Noivos premium". |
| `age_range` | texto/intervalo | Opcional. |
| `life_moment` | texto | Ex.: "planejando casamento", "esperando primeiro filho". |
| `needs` | lista | Necessidades objetivas. |
| `desires` | lista | Desejos/aspirações. |
| `concerns` | lista | Preocupações comuns (tempo, logística, exposição). |
| `common_objections` | lista estruturada | Ver formato em `SALES_STRATEGY_CONTEXT`. |
| `decision_drivers` | lista | O que pesa mais na decisão: preço, confiança, portfólio, indicação. |
| `price_sensitivity` | escala 1–5 | Calibra quanto a proposta precisa "justificar" valor. |
| `expected_experience` | texto | O que esse público espera do atendimento. |

**Uso pela IA:** ajusta quais benefícios são enfatizados e quais objeções são preventivamente endereçadas no texto — nunca decide preço.

---

## 8. Sales Strategy Context — estratégia de venda

Área: **Comercial → Estratégia → Como eu vendo**.

O fotógrafo pode selecionar **uma ou combinar múltiplas** estratégias do catálogo abaixo, com peso relativo (0–100%) quando combinadas. A IA deve respeitar a(s) estratégia(s) escolhida(s) como filtro de tom e ênfase — nunca como gerador de conteúdo, apenas como lente de apresentação.

### 8.1 Catálogo de estratégias de convencimento

#### 1. Venda por Valor Percebido
- **Descrição:** o texto ancora o preço em benefícios tangíveis e intangíveis específicos, para que o valor pareça superior ao número cobrado.
- **Objetivo:** reduzir a sensação de "caro" transformando preço em investimento justificado.
- **Quando usar:** quando o ticket é médio/alto e o cliente compara concorrentes por preço.
- **Cliente ideal:** racional, pesquisa antes de decidir, sensível a preço mas aberto a argumento.
- **Abordagem de comunicação:** listar entregáveis concretos + resultado emocional/prático de cada um; evitar apenas listar itens sem conectar a benefício.
- **Riscos:** parecer uma lista de vendas agressiva se usada sem equilíbrio com confiança.
- **Exemplo de aplicação:** bloco "O que está incluso" reescrito como "O que isso significa para você", ligando cada item do catálogo real a um benefício.
- **O que a IA deve considerar:** apenas itens reais do catálogo de serviços; nunca inflacionar benefícios não confirmados pelo fotógrafo.

#### 2. Venda por Experiência
- **Descrição:** o foco está em como será o processo de ser fotografado, não apenas no resultado final.
- **Objetivo:** vender a jornada — atendimento, cuidado, ambiente — como parte do produto.
- **Quando usar:** serviços com forte componente de atendimento (ensaios guiados, sessões em estúdio, eventos).
- **Cliente ideal:** valoriza conforto, quer se sentir cuidado, decide por percepção de atendimento.
- **Abordagem de comunicação:** narrativa em primeira pessoa do que o cliente vai viver; menos tabela, mais storytelling.
- **Riscos:** pode soar vago se não houver dados reais de processo (roteiro do ensaio, tempo de atendimento) para ancorar.
- **Exemplo de aplicação:** bloco "Como vai ser o seu dia" antes do bloco de pacotes.
- **O que a IA deve considerar:** só descrever etapas do processo que o fotógrafo de fato configurou (ver `service_catalog.process_steps`); nunca inventar roteiro.

#### 3. Venda por Exclusividade e Posicionamento
- **Descrição:** comunica escassez legítima, seletividade e posicionamento premium.
- **Objetivo:** justificar ticket alto pela raridade da vaga/atenção, não apenas pelo produto.
- **Quando usar:** `exclusivity_level` alto no Business Context, agenda limitada real, portfólio autoral forte.
- **Cliente ideal:** menos sensível a preço, sensível a status e curadoria.
- **Abordagem de comunicação:** tom mais contido, menos "venda", mais convite; frases curtas, muito espaço em branco (liga com seção 11).
- **Riscos:** escassez falsa (vagas "limitadas" que não existem de verdade) — a IA **nunca** deve gerar essa alegação sem um dado real de agenda/disponibilidade.
- **Exemplo de aplicação:** capa com pouquíssimo texto, um único CTA, ausência de "promoção".
- **O que a IA deve considerar:** só menciona limitação de agenda se houver campo real de disponibilidade preenchido; do contrário, omite.

#### 4. Venda por Segurança e Confiança
- **Descrição:** reduz risco percebido do cliente através de prova social real, garantias e clareza de processo.
- **Objetivo:** neutralizar objeções de confiança ("e se não gostar do resultado?", "é a primeira vez que contrato").
- **Quando usar:** público iniciante na categoria (ex.: primeira gestante, primeiro evento corporativo) ou alta sensibilidade a risco.
- **Cliente ideal:** cauteloso, pesquisa avaliações, quer garantias explícitas.
- **Abordagem de comunicação:** depoimentos reais, política clara de entrega/revisão, linguagem transparente sobre prazos.
- **Riscos:** a IA nunca deve gerar depoimentos, avaliações ou números (ex.: "500 casais atendidos") que não existam no banco de dados.
- **Exemplo de aplicação:** bloco de depoimentos reais + bloco de "como funciona" com prazos reais do fotógrafo.
- **O que a IA deve considerar:** só usa depoimentos cadastrados; se não houver nenhum, omite o bloco (nunca inventa).

#### 5. Venda por Transformação e Resultado
- **Descrição:** foca no "antes e depois" — o que muda na vida do cliente com aquele registro (memória, legado, marketing pessoal).
- **Objetivo:** conectar a fotografia a um resultado maior que a própria imagem.
- **Quando usar:** fotografia de família, newborn, corporativo/pessoal branding, onde há um objetivo claro por trás do registro.
- **Cliente ideal:** motivado por propósito/significado mais do que por estética isolada.
- **Abordagem de comunicação:** linguagem sobre legado, memória, impacto; menos técnica, mais emocional.
- **Riscos:** exagero emocional sem lastro; deve equilibrar com fatos concretos do serviço.
- **Exemplo de aplicação:** abertura da proposta com uma frase de propósito antes de qualquer informação comercial.
- **O que a IA deve considerar:** o propósito declarado deve vir do briefing do cliente (`CLIENT_CONTEXT`), não ser genérico.

#### 6. Venda Consultiva
- **Descrição:** a proposta é apresentada como resultado de um diagnóstico, não como oferta padrão — reflete de volta o que o cliente disse precisar.
- **Objetivo:** criar percepção de "feito sob medida" através de espelhamento do briefing.
- **Quando usar:** quando existe briefing rico do cliente (reunião, formulário, conversa prévia).
- **Cliente ideal:** decisor racional, valoriza ser ouvido, compara propostas por adequação e não só por preço.
- **Abordagem de comunicação:** abrir citando/parafraseando a necessidade relatada pelo cliente, depois conectar com a solução.
- **Riscos:** exige briefing real preenchido — sem isso, a estratégia não deve ser aplicada (fallback: pedir preenchimento do briefing antes de gerar).
- **Exemplo de aplicação:** seção "Entendi que você precisa de..." construída a partir de `CLIENT_CONTEXT.briefing`.
- **O que a IA deve considerar:** nunca reformula o briefing de um jeito que mude seu sentido original; se o briefing estiver vazio, a estratégia consultiva fica indisponível para aquela proposta.

> Estratégias adicionais como "venda emocional" e "venda por conveniência" foram avaliadas e **absorvidas** como variações de tom dentro das seis acima (ex.: conveniência é uma ênfase dentro de Segurança e Confiança; emoção é uma ênfase dentro de Transformação e Resultado), para evitar fragmentação excessiva do catálogo — mantendo-o extensível sem virar uma lista infinita.

### 8.2 Estrutura de configuração do fotógrafo

```json
{
  "selected_strategies": [
    { "strategy_id": "valor_percebido", "weight": 60 },
    { "strategy_id": "seguranca_confianca", "weight": 40 }
  ],
  "notes": "Prefiro nunca soar 'vendedor'. Evitar urgência artificial."
}
```

O campo `notes` é texto livre e entra como preferência forte (não obrigatória), permitindo nuance sem exigir uma nova categoria estrutural a cada pedido incomum.

---

## 9. Client Context

Estrutura por cliente/lead, alimentada pelo CRM e pelo módulo de WhatsApp (já em desenvolvimento):

| Campo | Tipo | Origem | Observações |
|---|---|---|---|
| `client_id` | referência | Sistema | — |
| `name` | texto | Sistema | Dado real, nunca gerado. |
| `service_interest` | referência a `service_catalog` | Sistema/Fotógrafo | Tipo de ensaio de interesse. |
| `relationship_history` | enum (`novo`, `recorrente`, `indicação`) | Sistema | Influencia tom (cliente recorrente = menos "apresentação institucional"). |
| `lead_source` | enum (`whatsapp`, `instagram`, `indicação`, `site`, `outro`) | Sistema | Contexto, não conteúdo direto. |
| `identified_need` | texto | Fotógrafo (briefing) | Base da venda consultiva (seção 8). |
| `briefing_answers` | objeto estruturado | Fotógrafo/Cliente (formulário) | Perguntas e respostas de briefing, se o módulo existir. |
| `budget_signal` | texto/enum opcional | Fotógrafo | Nunca vira preço — só calibra qual pacote priorizar na ordem de exibição. |
| `preferences` | texto | Fotógrafo | Ex.: "prefere fotos em preto e branco". |
| `objections_raised` | lista | Fotógrafo | Objeções já levantadas nesta negociação específica. |
| `purchase_moment` | enum (`primeiro_contato`, `negociação`, `decisão_final`, `pós_recusa`) | Sistema/Fotógrafo | Ajusta tom (ex.: proposta de "última milha" é mais direta). |
| `photographer_notes` | texto livre | Fotógrafo | Observações internas — pode conter contexto sensível; nunca renderizado literalmente na proposta, apenas usado como pista de tom. |
| `conversation_history_ref` | referência (opcional, futuro) | Sistema (WhatsApp) | Somente se autorizado pelo fotógrafo; tratado como dado sensível. |

**Regra crítica:** tudo neste contexto é **dado real de leitura**. A IA nunca gera ou infere um valor aqui — ela apenas lê.

---

## 10. Quote Context

Dados específicos da proposta que está sendo criada:

| Campo | Tipo | Observações |
|---|---|---|
| `quote_id` | referência | — |
| `client_id` | referência | Liga a `CLIENT_CONTEXT`. |
| `selected_services` | lista de referências a `service_catalog` | Fonte única de verdade de preço/descrição. |
| `custom_line_items` | lista opcional | Itens avulsos adicionados manualmente pelo fotógrafo (não gerados pela IA). |
| `validity_period` | data | Real, não inventada. |
| `payment_conditions` | referência a política cadastrada | Nunca gerada livremente. |
| `quote_status` | enum (`rascunho`, `enviada`, `visualizada`, `aceita`, `recusada`, `expirada`) | — |
| `version_number` | inteiro | Ver seção 28. |
| `generation_request` | objeto | Contém `SESSION_INSTRUCTIONS` (o pedido específico do fotógrafo naquela geração). |

---

## 11. Design Context — preferências estéticas

Este é o contexto mais sensível: precisa dar liberdade real sem virar um construtor de HTML livre. A solução é tratar estilo como **um conjunto de atributos interpretáveis**, não como templates fechados nem como CSS livre.

### 11.1 Modelo de atributos de estilo

| Atributo | Tipo | Intervalo/opções |
|---|---|---|
| `density` | escala | `minimalista` → `denso em informação` (1–5) |
| `tone_visual` | enum múltiplo | `sofisticado`, `divertido`, `editorial`, `clássico`, `moderno`, `ousado`, `delicado` — combináveis, com pesos |
| `typography_scale` | enum | `discreta`, `equilibrada`, `impactante` (mapeia para tokens de tipografia, seção 13) |
| `image_dominance` | escala | `texto predominante` → `imagem predominante` (1–5) |
| `whitespace_level` | escala | 1–5 |
| `color_intensity` | escala | `neutro` → `vibrante` (1–5), restrito à paleta de `BRAND_CONTEXT` |
| `layout_energy` | enum | `simétrico/estável` vs. `assimétrico/dinâmico` |
| `free_text_description` | texto livre | Ex.: "quero uma proposta minimalista e sofisticada" — interpretado e traduzido para os atributos acima (seção 24) |

Isso resolve diretamente a preocupação da seção 20 do briefing original ("não transformar em sistema engessado"): não existe uma lista fechada de 5 templates. Existe um espaço de atributos combináveis, e a IA tem liberdade para navegar dentro dele — mas cada atributo, ao ser aplicado, é **traduzido em tokens e props de componentes já suportados** (seção 13), nunca em CSS arbitrário.

### 11.2 Dois níveis de preferência

- **Preferência padrão do fotógrafo** (`DESIGN_PREFERENCES` em Comercial → Estratégia → Estilo): aplicada a toda proposta nova por padrão.
- **Override por proposta** (`SESSION_INSTRUCTIONS`): o que o fotógrafo pede *naquele momento* ("quero algo mais divertido para essa família"), que vale só para aquela geração e nunca sobrescreve o padrão salvo, a menos que o fotógrafo confirme explicitamente.

---

## 12. Responsive Layout Contract

Este é o núcleo da proteção técnica pedida no briefing. É **imutável do ponto de vista do fotógrafo e da IA** — só muda por decisão de engenharia do Lunari, versionado.

### 12.1 Breakpoints de referência

| Nome | Largura | Uso |
|---|---|---|
| `mobile` | até 640px | Coluna única obrigatória |
| `tablet` | 641–1024px | 1–2 colunas conforme componente |
| `desktop` | acima de 1024px | Layout completo do componente |

### 12.2 Regras obrigatórias (não negociáveis pela IA)

1. **Nenhuma altura fixa em pixels para blocos de conteúdo.** Sempre `min-height` + conteúdo fluido, ou `aspect-ratio` para mídia.
2. **Toda imagem de fundo/capa precisa de `focal_point`** (coordenada x/y, 0–100%) para permitir recorte inteligente em qualquer proporção — nunca crop cego.
3. **Todo texto sobre imagem exige overlay/scrim configurado** com contraste mínimo garantido (a IA escolhe intensidade dentro de um intervalo pré-aprovado, nunca cor livre sem checagem de contraste).
4. **Grids colapsam para coluna única em `mobile`** — a ordem de colapso (qual bloco vem primeiro) é definida por `priority` no componente, não por posição visual.
5. **Elementos com posicionamento absoluto/sobreposto exigem um `stacking_fallback`** definido: comportamento explícito de como se reorganizam em telas estreitas (nunca "deixar como está e cortar").
6. **Tipografia usa escala fluida (`clamp()`), nunca `px` fixo por breakpoint manual.** A IA escolhe o *token* de escala (seção 11), o sistema resolve o CSS.
7. **Nenhum conteúdo essencial pode depender apenas de `hover`** (não existe hover confiável em touch).
8. **Overflow de texto nunca é `hidden` sem alternativa** — usar truncamento com "ver mais" ou permitir crescimento do bloco; nunca cortar preço, condição ou CTA.
9. **Todo componente precisa declarar seu comportamento nos 3 breakpoints** no `COMPONENT_REGISTRY" (seção 13) — se não declarar, não pode ser usado pela IA.
10. **Área de toque mínima de 44×44px** para qualquer elemento interativo (CTA, botão, link).
11. **Safe areas:** margens mínimas laterais garantidas em mobile (nunca conteúdo colado na borda), especialmente em capas com imagem de fundo.
12. **Fallback de composição complexa:** qualquer composição "editorial" (sobreposição, assimetria) precisa de uma variante linear pré-definida para mobile — a IA escolhe a variante, não desenha o fallback.

### 12.3 Por que isso não limita a criatividade

O fotógrafo continua podendo pedir "capa com foto ocupando a tela toda e título gigante". A IA vai:
- escolher o componente `CoverBlock` com variante `full_bleed_image`;
- definir `focal_point` a partir da imagem selecionada (ou solicitar que o fotógrafo marque o ponto focal, se a imagem for nova);
- escolher o token `typography_scale = impactante`;
- deixar o sistema resolver automaticamente como isso se comporta em mobile, porque o componente `CoverBlock` já tem essa regra embutida.

A criatividade acontece na *escolha e combinação*, não na *invenção da mecânica*.

---

## 13. Component Architecture — arquitetura anti-alucinação de HTML

Esta é a decisão arquitetural mais importante do documento, e é a que a pesquisa técnica mais valida: sistemas de IA que geram interface confiável usam **geração declarativa e limitada**, nunca HTML/CSS livre. A IA emite uma especificação estruturada que referencia componentes pré-aprovados por nome — o sistema valida cada campo contra o catálogo antes de renderizar. Esse padrão (às vezes chamado *contract-first generative UI*) elimina por construção a possibilidade de a IA inventar uma tag, uma propriedade CSS ou uma estrutura sem fallback responsivo, porque só existe caminho do output da IA até um componente que o time do Lunari escreveu e testou.

### 13.1 Estrutura

```
COMPONENT_REGISTRY (mantido pela engenharia do Lunari)
  └─ Component
       ├─ type: "CoverBlock" | "TextSection" | "ServiceGrid" | "PricingTable"
       │        | "TestimonialBlock" | "Gallery" | "FAQBlock" | "CTABlock" | "FooterTerms"
       ├─ variants: [lista de variantes suportadas, cada uma já responsiva]
       ├─ props_schema: JSON Schema das propriedades configuráveis
       ├─ responsive_behavior: comportamento nos 3 breakpoints (seção 12)
       └─ content_slots: quais campos de CONTEÚDO (seção 14) esse componente aceita
```

### 13.2 Exemplo de componente no registry (conceitual)

```json
{
  "type": "CoverBlock",
  "variants": ["full_bleed_image", "split_image_text", "minimal_typographic"],
  "props_schema": {
    "image_ref": { "type": "string", "required_if": "variant != minimal_typographic" },
    "focal_point": { "type": "object", "properties": { "x": "number", "y": "number" } },
    "overlay_intensity": { "type": "enum", "values": ["none", "light", "medium", "strong"] },
    "typography_scale_token": { "type": "enum", "values": ["discreta", "equilibrada", "impactante"] },
    "alignment": { "type": "enum", "values": ["left", "center", "right"] }
  },
  "content_slots": ["title", "subtitle", "cta_label"]
}
```

### 13.3 O que a IA pode decidir

- Qual `type` de componente usar em cada seção da proposta.
- Qual `variant` dentro daquele tipo.
- Valores dos `props` dentro dos limites do `props_schema`.
- Ordem e presença/ausência de componentes (respeitando regras obrigatórias, ex.: sempre precisa haver um bloco de condições comerciais).

### 13.4 O que a IA nunca pode fazer

- Emitir um `type` que não exista no registry.
- Emitir um `prop` fora do `props_schema` (validação rejeita e aciona repair/retry, seção 20).
- Emitir HTML, CSS ou JavaScript bruto.
- Definir comportamento responsivo próprio — isso é sempre herdado do componente.

### 13.5 Validação (Validation Gate)

Todo output da IA passa por: (1) validação de schema JSON contra o `COMPONENT_REGISTRY`; (2) checagem de que todo dado factual citado (preço, nome, serviço) existe literalmente em `QUOTE_CONTEXT`/`CLIENT_CONTEXT` — não em texto livre inventado; (3) checagem do `LAYOUT_CONTRACT`. Se falhar, o sistema devolve o erro estruturado para nova tentativa (padrão de "self-healing" bem estabelecido em pipelines de geração estruturada), nunca expõe um resultado inválido ao fotógrafo.

---

## 14. As três camadas: Conteúdo, Estratégia, Apresentação

| Camada | Pergunta que responde | Onde vive | Exemplo |
|---|---|---|---|
| **Conteúdo** | O quê? | `content_slots` do componente | "Ensaio externo de 2h, 40 fotos editadas" |
| **Estratégia** | Por quê assim? | `SALES_STRATEGY_CONTEXT` (guia a escolha de ênfase, não o texto em si) | Enfatizar isso como "tempo dedicado a você", não só "2h" |
| **Apresentação** | Como visualmente? | `props` do componente + `DESIGN_CONTEXT` | Tipografia grande, bloco isolado, muito espaço em branco |

Essa separação existe como **contrato de dados**, não apenas como boa intenção: o payload de contexto (seção 19) mantém esses três blocos fisicamente separados, e as regras de validação (13.5) recusam qualquer geração que misture, por exemplo, uma decisão de apresentação dentro de um campo de conteúdo.

---

## 15. Motor de regras

| Categoria | Definição | A IA pode desviar? | Exemplos |
|---|---|---|---|
| **Regras obrigatórias** | Vêm de `SYSTEM_RULES` + `LAYOUT_CONTRACT` | **Nunca** | Contraste mínimo de texto sobre imagem; nunca inventar preço; sempre incluir bloco de condições comerciais; `forbidden_words` de `BRAND_CONTEXT`. |
| **Regras recomendadas** | Vêm de boas práticas comerciais configuradas | Sim, com justificativa registrada | "Evitar mais de 3 pacotes por proposta" — pode ser ultrapassado se o fotógrafo pediu explicitamente. |
| **Preferências** | Vêm de `DESIGN_PREFERENCES`, `SALES_STRATEGY_CONTEXT.notes`, `BRAND_CONTEXT.tone_of_voice` | Sim, livremente, dentro do espaço de atributos (seção 11) | Densidade visual, tom de voz, ênfase estratégica. |
| **Liberdade criativa** | Tudo que não foi especificado em nenhuma camada acima | Sim, total, dentro dos limites técnicos | Escolha de qual variante de `TextSection` usar quando não há preferência declarada. |

---

## 16. Hierarquia de prioridade e resolução de conflitos

Baseando-se em como sistemas de contexto para agentes de produção resolvem conflitos — dando autoridade máxima às instruções do operador (aqui, o próprio Lunari) e aos dados recuperados de fontes confiáveis, autoridade intermediária às instruções explícitas do usuário na sessão, e liberdade apenas no que sobra — a hierarquia recomendada para o Lunari é:

1. **`SYSTEM_RULES` + `LAYOUT_CONTRACT` + `COMPONENT_REGISTRY`** — regras técnicas e de segurança do sistema. Nunca são sobrescritas por nada.
2. **Dados reais** (`CLIENT_CONTEXT`, `QUOTE_CONTEXT.selected_services`, catálogo de serviços/preços) — fatos não são opinião; nenhuma preferência estética ou estratégica pode alterar um fato.
3. **`SESSION_INSTRUCTIONS`** — o pedido explícito do fotógrafo naquela geração específica ("quero algo mais divertido para essa família") tem prioridade sobre configurações padrão, porque reflete intenção humana atual e direta.
4. **`SALES_STRATEGY_CONTEXT`** — estratégia comercial configurada como padrão.
5. **`BRAND_CONTEXT`** — identidade de marca (tom, vocabulário, cores).
6. **`DESIGN_PREFERENCES`** — preferências visuais padrão salvas.
7. **Liberdade criativa da IA** — preenche qualquer lacuna não coberta pelos níveis acima.

**Regra de conflito:** quando duas camadas do mesmo nível colidem (ex.: `SALES_STRATEGY_CONTEXT` sugere tom direto, mas `BRAND_CONTEXT.tone_of_voice` é "poético"), a IA prioriza a camada de nível mais alto (aqui, estratégia vence) e deve registrar no log de geração (seção 26) que houve uma resolução de conflito — isso é dado valioso para o fotógrafo eventualmente ajustar sua configuração.

---

## 17. Regras anti-alucinação

### 17.1 Princípio de grounding

A técnica com maior evidência de eficácia (estudos citados na seção 32 mostram acurácia substancialmente maior com contexto bem fundamentado versus geração livre) é transformar a tarefa de "escrita criativa" em "leitura e composição": os dados reais (preço, serviço, nome, política) são injetados como contexto de leitura, com instrução explícita de que **só pode ser usado o que está literalmente presente ali**.

### 17.2 O que a IA nunca pode gerar sozinha

| Nunca inventar | Comportamento correto quando falta |
|---|---|
| Preços | Usar exclusivamente `service_catalog`/`price_table`; se o serviço solicitado não tiver preço cadastrado, sinalizar campo pendente — nunca estimar. |
| Serviços/pacotes | Só listar o que existe em `service_catalog`. |
| Depoimentos/avaliações | Só usar depoimentos cadastrados; se não houver, omitir o bloco. |
| Políticas comerciais (prazo, revisão, cancelamento) | Só usar política cadastrada; se ausente, omitir a menção em vez de generalizar. |
| Dados do cliente | Só usar `CLIENT_CONTEXT`; nunca supor histórico, orçamento ou preferência não informados. |
| Disponibilidade/escassez ("últimas vagas") | Só mencionar se houver campo real de disponibilidade preenchido. |
| Recursos do editor/sistema | Só usar componentes do `COMPONENT_REGISTRY`. |
| Regras de negócio | Nunca decidir descontos, condições especiais ou exceções não configuradas. |

### 17.3 Comportamentos permitidos diante de lacuna

1. **Usar dado existente** — sempre a primeira opção.
2. **Deixar campo explicitamente pendente** — ex.: bloco de depoimentos omitido, nunca substituído por texto genérico.
3. **Sinalizar ao fotógrafo** — no momento da geração, listar o que não pôde ser preenchido por falta de dado (ex.: "este cliente não tem briefing preenchido — a estratégia consultiva não pôde ser aplicada").
4. **Sugerir, nunca assumir** — a IA pode sugerir um texto de exemplo claramente marcado como sugestão editável, nunca apresentado como fato definitivo.
5. **Nunca preencher silenciosamente** — todo preenchimento automático de lacuna deve aparecer no log de geração como decisão registrada, nunca como texto indistinguível do dado real.

---

## 18. Modelo de dados (entidades para Supabase)

Formato conceitual — nomes de tabela sugeridos, sem SQL final (a definir na implementação):

```
photographer_business_context
 ├─ id, photographer_id (FK)
 ├─ positioning_statement, value_proposition
 ├─ differentiators (jsonb array)
 ├─ desired_perception (enum), exclusivity_level (int 1-5)
 ├─ ideal_client_profile (text), ticket_range (enum)
 ├─ experience_type (jsonb array)
 └─ updated_at, version

brand_context
 ├─ id, photographer_id (FK)
 ├─ brand_name, tone_of_voice (jsonb array)
 ├─ preferred_vocabulary (jsonb array), forbidden_words (jsonb array)
 ├─ formality_level (int), logo_asset_id (FK → assets)
 ├─ color_tokens (jsonb), typography_tokens (jsonb)
 └─ updated_at, version

audience_profiles
 ├─ id, photographer_id (FK)
 ├─ segment_name, age_range, life_moment
 ├─ needs, desires, concerns (jsonb arrays)
 ├─ common_objections (jsonb array de {objection, suggested_handling})
 ├─ decision_drivers (jsonb array), price_sensitivity (int)
 ├─ expected_experience (text)
 └─ updated_at

sales_strategy_catalog          -- system-owned, seed data (as 6 estratégias)
 ├─ id, strategy_key, name, description, objective
 ├─ when_to_use, ideal_client, communication_approach
 ├─ risks, ai_considerations
 └─ version

photographer_sales_strategy_config
 ├─ id, photographer_id (FK)
 ├─ selected_strategies (jsonb array de {strategy_id, weight})
 ├─ notes (text)
 └─ updated_at

service_catalog
 ├─ id, photographer_id (FK)
 ├─ name, description, category
 ├─ deliverables (jsonb array), process_steps (jsonb array, opcional)
 ├─ price (numeric), price_unit (enum), active (bool)
 └─ updated_at

design_preferences
 ├─ id, photographer_id (FK), scope (enum: 'default' | 'quote_override'), quote_id (FK, nullable)
 ├─ density (int 1-5), tone_visual (jsonb array com pesos)
 ├─ typography_scale (enum), image_dominance (int 1-5)
 ├─ whitespace_level (int 1-5), color_intensity (int 1-5)
 ├─ layout_energy (enum), free_text_description (text)
 └─ updated_at

clients
 ├─ id, photographer_id (FK)
 ├─ name, contact_info, relationship_history (enum), lead_source (enum)
 └─ created_at

client_briefings
 ├─ id, client_id (FK)
 ├─ identified_need (text), briefing_answers (jsonb)
 ├─ budget_signal (enum, nullable), preferences (text)
 ├─ objections_raised (jsonb array), purchase_moment (enum)
 ├─ photographer_notes (text)
 └─ updated_at

quotes
 ├─ id, photographer_id (FK), client_id (FK)
 ├─ status (enum), validity_period (date)
 ├─ payment_conditions_ref (FK → payment_policies)
 ├─ current_version_id (FK → quote_versions)
 └─ created_at, updated_at

quote_versions
 ├─ id, quote_id (FK), version_number (int)
 ├─ ai_context_snapshot_id (FK → ai_context_snapshots, nullable se edição manual)
 ├─ component_tree (jsonb)          -- a "proposta estruturada" (seção 23)
 ├─ change_summary (text, nullable) -- o que mudou desta versão para a anterior
 ├─ created_by (enum: 'ai' | 'photographer')
 └─ created_at

component_registry            -- system-owned
 ├─ id, type, variants (jsonb), props_schema (jsonb)
 ├─ responsive_behavior (jsonb), content_slots (jsonb array)
 └─ version

layout_contract_rules         -- system-owned
 ├─ id, rule_key, description, rule_definition (jsonb)
 └─ version

ai_context_snapshots
 ├─ id, quote_id (FK)
 ├─ payload (jsonb)             -- o payload completo enviado (seção 19), congelado
 ├─ context_version (text)      -- versão do contrato de contexto usado
 ├─ session_instructions (jsonb)
 └─ created_at

ai_generation_logs
 ├─ id, ai_context_snapshot_id (FK)
 ├─ raw_output (jsonb), validation_result (jsonb)
 ├─ conflicts_resolved (jsonb array)
 ├─ fields_left_pending (jsonb array)
 ├─ status (enum: 'success' | 'validation_failed' | 'retried')
 └─ created_at
```

**Notas de design:**
- Toda entidade de contexto configurável tem `updated_at`/`version` — necessário para o `ai_context_snapshots` referenciar exatamente qual versão de cada contexto estava em vigor no momento da geração (rastreabilidade completa).
- `component_registry` e `layout_contract_rules` são **system-owned**: nenhuma policy de RLS deve permitir escrita por fotógrafos.
- `sales_strategy_catalog` é seed data versionada pelo Lunari; a tabela do fotógrafo (`photographer_sales_strategy_config`) apenas referencia e pondera.

---

## 19. Estrutura de contexto para a futura API

Payload conceitual que o `Context Assembler` monta antes de qualquer chamada a um provedor de IA (a chamada em si é fase futura — ver seção 31):

```json
{
  "context_version": "2026-08-lunari-v1",
  "system_rules": { "...": "regras obrigatórias, ver seção 15" },
  "layout_contract": { "...": "ver seção 12" },
  "component_registry_ref": "v1.3",

  "business_context": { "...": "ver seção 5" },
  "brand_context": { "...": "ver seção 6" },
  "audience_context": { "...": "ver seção 7" },
  "sales_strategy_context": { "...": "ver seção 8" },
  "design_preferences": { "...": "ver seção 11" },

  "client_context": { "...": "ver seção 9" },
  "quote_context": { "...": "ver seção 10" },

  "session_instructions": {
    "raw_request": "Quero uma proposta minimalista e sofisticada para essa cliente.",
    "requested_changes": null
  },

  "priority_order": [
    "system_rules", "layout_contract", "component_registry",
    "real_data", "session_instructions",
    "sales_strategy_context", "brand_context", "design_preferences",
    "ai_creative_freedom"
  ],

  "output_contract": {
    "must_conform_to": "component_registry",
    "forbidden_output": ["raw_html", "raw_css", "invented_facts", "invented_components"],
    "on_missing_data": "flag_as_pending"
  }
}
```

**O que entra:** somente dados versionados e validados das camadas acima. **O que não entra:** rascunhos não salvos, dados de outros fotógrafos, histórico de conversa não autorizado, qualquer informação sensível não explicitamente marcada como utilizável.

---

## 20. Fluxo de geração de proposta

Mapeando exatamente o fluxo descrito no pedido original, com os pontos de validação explícitos:

1. **Fotógrafo pede uma proposta** → cria `session_instructions`.
2. **Context Assembler consulta dados reais do cliente** (`CLIENT_CONTEXT`) e **do orçamento** (`QUOTE_CONTEXT.selected_services` com preços do `service_catalog`).
3. **Monta o `BUSINESS_CONTEXT` + `BRAND_CONTEXT`** do fotógrafo.
4. **Resolve `SALES_STRATEGY_CONTEXT`** (estratégias selecionadas + pesos).
5. **Resolve `DESIGN_PREFERENCES`** (padrão + eventual override da sessão).
6. **Monta o payload completo** (seção 19) e **salva como `ai_context_snapshot`** (imutável, versionado) — isso acontece **antes** de qualquer chamada de IA, então o snapshot existe mesmo que a geração falhe.
7. *(Fase futura)* Chamada ao provedor de IA com o payload.
8. **Validation Gate:** valida contra `component_registry` (schema), contra `layout_contract` (regras técnicas), e checa que todo fato citado existe literalmente nos dados reais (grounding check).
9. Se inválido → **repair loop**: erro estruturado devolvido, nova tentativa (limite de tentativas configurável); se persistir, marca geração como falha e notifica o fotógrafo.
10. Se válido → resultado vira `component_tree` salvo em `quote_versions`, `created_by = 'ai'`.
11. **Apresentação no editor** (fora de escopo desta fase — só o contrato de dados que o editor vai consumir).

---

## 21. Fluxo de revisão / iteração

1. Fotógrafo altera algo no editor (manualmente) **ou** pede uma alteração em linguagem natural.
2. Se manual: nova `quote_versions` criada com `created_by = 'photographer'`, `component_tree` atualizado diretamente — **não passa pela IA**, mas é versionado igual.
3. Se via linguagem natural: a alteração vira um novo `session_instructions.requested_changes`, referenciando a versão atual do `component_tree` como ponto de partida (não do zero).
4. O `Context Assembler` monta um novo snapshot que inclui o `component_tree` anterior como "estado atual" — a IA deve **editar**, não **recriar**, exceto se o pedido explicitamente for de recomeçar.
5. Mesmo Validation Gate se aplica. Nova versão salva com `change_summary` preenchido (o que mudou e por quê), o que também alimenta o log para futura análise de padrões de edição (fora de escopo agora — mencionado em "o que não implementar", seção 31).

---

## 22. Fluxo de personalização por cliente

Este fluxo é, na prática, a composição de `CLIENT_CONTEXT` + `SALES_STRATEGY_CONTEXT` (especialmente a estratégia consultiva, seção 8) dentro do fluxo de geração (seção 20). Não é um pipeline separado — é o resultado natural de o `Context Assembler` sempre puxar o `CLIENT_CONTEXT` daquele cliente específico antes de montar o payload. O ponto de atenção arquitetural é: **nunca cachear um `component_tree` gerado para um cliente e reaplicar para outro** sem passar de novo pelo Context Assembler — cada proposta é uma composição nova sobre dados novos.

---

## 23. Editor futuro — representação estruturada

A proposta **nunca** deve ser representada como HTML bruto internamente — apenas como **árvore de componentes em JSON**, que o Renderer (futuro) transforma em HTML/CSS no momento de exibir. Isso é o que permite: edição segura pelo fotógrafo, diffs entre versões, reaproveitamento em outros formatos (PDF, link público) e evolução do sistema de design sem quebrar propostas antigas.

```json
{
  "version": "2026-08-lunari-v1",
  "blocks": [
    {
      "id": "block_1",
      "type": "CoverBlock",
      "variant": "full_bleed_image",
      "props": { "image_ref": "asset_123", "focal_point": {"x": 50, "y": 30}, "overlay_intensity": "light", "typography_scale_token": "impactante", "alignment": "center" },
      "content": { "title": "Uma tarde para vocês dois", "subtitle": "Proposta preparada especialmente para Ana e Marcelo", "cta_label": null }
    },
    {
      "id": "block_2",
      "type": "ServiceGrid",
      "variant": "cards_2col",
      "props": { "priority_mobile_order": ["service_a", "service_b"] },
      "content": { "services_ref": ["service_a", "service_b"] }
    }
  ]
}
```

Esse formato já é o contrato que o futuro editor visual (drag-and-drop, edição inline) vai consumir — por isso é importante fixá-lo agora, mesmo sem construir o editor ainda.

---

## 24. Exemplos práticos

### "Quero uma proposta minimalista e sofisticada."
- **Contexto:** `session_instructions.raw_request` → interpretado para `design_preferences override`: `density=2`, `whitespace_level=5`, `tone_visual=["sofisticado","minimalista"]`, `typography_scale=discreta ou equilibrada`.
- **Estratégia:** provavelmente reforça Exclusividade/Posicionamento se configurada; senão, não força nenhuma estratégia por causa do pedido de estilo (estilo ≠ estratégia).
- **Decisões de design:** poucos componentes por seção, `CoverBlock` variant `minimal_typographic`, muito espaço entre blocos.
- **Componentes:** `CoverBlock`, `TextSection` curto, `PricingTable` variant `single_column`.
- **Regras responsivas:** aplicadas normalmente, sem exceção — minimalismo não isenta do Layout Contract.

### "Quero uma proposta infantil, divertida e colorida."
- **Contexto:** `tone_visual=["divertido"]`, `color_intensity=5` (dentro da paleta de marca — se a marca não tiver cores vibrantes cadastradas, a IA sinaliza que a paleta atual limita esse pedido, em vez de inventar cores fora do `color_tokens`).
- **Componentes:** `Gallery` com variant mais visual, `ServiceGrid` com cards arredondados (`props.corner_radius_token = alto`, se suportado pelo registry).
- **Regra crítica:** "divertido" nunca autoriza a IA a criar um componente novo — só a escolher variantes existentes com esse caráter.

### "Quero uma proposta editorial, com fotos grandes e pouca informação por página."
- **Contexto:** `image_dominance=5`, `density=1`.
- **Componentes:** `Gallery` variant `full_width_stack`, `TextSection` variant `caption_only`.
- **Regra responsiva:** cada "página"/seção com foto grande precisa de `focal_point` obrigatório — se a imagem não tiver, a IA solicita ao fotógrafo antes de finalizar.

### "Quero uma proposta premium com bastante espaço em branco."
- **Contexto:** `whitespace_level=5`, possivelmente reforça `ticket_range=alto`/`exclusivity_level` do Business Context.
- **Regra:** espaço em branco é resolvido via tokens de espaçamento do design system — nunca via margin/padding livre.

### "Quero letras grandes e impacto visual."
- **Contexto:** `typography_scale=impactante`.
- **Regra crítica:** a escala tipográfica "impactante" já vem com seu comportamento responsivo definido no `component_registry` (via `clamp()`) — a IA nunca define tamanho em px.

### "Quero uma proposta extremamente visual, com imagens ocupando grande parte da página."
- **Contexto:** `image_dominance=5`.
- **Regra crítica:** cada imagem usada precisa existir de fato (asset real do fotógrafo ou do briefing do cliente) — a IA nunca referencia uma imagem que não foi enviada/selecionada.

Em nenhum dos seis exemplos a resposta correta é "gerar HTML/CSS livre para atender ao pedido" — em todos, o pedido em linguagem natural é traduzido para atributos estruturados, que por sua vez selecionam variantes e props de componentes já existentes e responsivos.

---

## 25. Casos extremos e regras de fallback

| Caso | Comportamento correto |
|---|---|
| Cliente sem briefing preenchido + estratégia consultiva selecionada | Estratégia consultiva fica indisponível para esta geração; sistema usa a segunda estratégia configurada (por peso) ou sinaliza ao fotógrafo. |
| Serviço sem preço cadastrado | Bloco daquele serviço marcado como pendente; proposta não é finalizada automaticamente sem preço. |
| Pedido de estilo que conflita com regra obrigatória (ex.: "sem espaço nenhum entre elementos") | Regra obrigatória vence (área de toque mínima, legibilidade); IA aplica a intenção dentro do limite técnico e pode informar a limitação. |
| Fotógrafo pede combinação de estratégias contraditórias (ex.: urgência forte + tom "nunca soar vendedor") | Segue a hierarquia de pesos configurada; registra o conflito no log de geração. |
| Imagem sem ponto focal definido usada em capa full-bleed | Sistema solicita definição do ponto focal antes de permitir a geração daquele bloco (não deixa a IA adivinhar). |
| Falha de validação repetida (limite de tentativas atingido) | Geração marcada como falha; fotógrafo é notificado; nenhum resultado inválido é exposto. |
| Marca sem paleta de cores cadastrada | Sistema usa paleta neutra padrão do Lunari até que a marca configure a própria. |

---

## 26. Recomendações de implementação no backend

1. Implementar o **Context Assembler** como serviço isolado (função/módulo dedicado), não espalhado em várias rotas — ele é o único responsável por montar o payload da seção 19.
2. O Context Assembler deve ser **puro em relação a IA**: nesta fase, ele só monta e persiste o `ai_context_snapshot`. Não deve existir nenhuma chamada a modelo de IA ainda (ver seção 31).
3. Toda tabela de contexto configurável precisa de `updated_at` e, idealmente, um campo de versão simples (inteiro incremental), para permitir reconstruir "qual era a configuração no momento X".
4. `component_registry` e `layout_contract_rules` devem ser **seed data** gerenciada por migration/config do Lunari, nunca por interface de usuário do fotógrafo.
5. RLS no Supabase: fotógrafo só lê/escreve seus próprios contextos (`photographer_id = auth.uid()` ou equivalente); tabelas system-owned (`component_registry`, `layout_contract_rules`, `sales_strategy_catalog`) são somente leitura para todos os fotógrafos.
6. Modelar `quote_versions.component_tree` como `jsonb` com um schema JSON Schema formal versionado — permite validação no banco (via constraint/trigger, se desejado) além da validação de aplicação.
7. Criar desde já a tabela `ai_generation_logs`, mesmo antes de existir geração de IA real — ela também serve para logar edições manuais e o pipeline de validação assim que existir.

---

## 27. Recomendação de estrutura Supabase

- Schemas separados por domínio, se o projeto já não tiver: `commercial` (business/brand/audience/sales strategy/design preferences), `crm` (clients/briefings), `quoting` (quotes/quote_versions), `system` (component_registry/layout_contract_rules/sales_strategy_catalog).
- Edge Functions dedicadas: uma para `assemble-context` (monta e persiste snapshot), separada de qualquer futura função `generate-proposal` — mantém a fronteira entre "montar contexto" e "chamar IA" limpa desde o início, o que facilita trocar de provedor de IA sem tocar no Context Assembler.
- Índices em `quotes.client_id`, `quote_versions.quote_id`, `ai_context_snapshots.quote_id` para consultas de histórico.
- Armazenar `component_tree` e `payload` (do snapshot) como `jsonb` (não `text`), para permitir queries futuras (ex.: "quantas propostas usaram a estratégia X").

---

## 28. Estratégia de versionamento

- **Versionamento de conteúdo:** cada geração ou edição de uma proposta cria uma nova linha em `quote_versions` (nunca sobrescreve) — permite comparar versões e reverter.
- **Versionamento de contrato:** `context_version` (payload) e `component_registry.version` são versionados independentemente do conteúdo — permite saber se uma proposta antiga foi gerada sob regras diferentes das atuais, sem quebrar a leitura de propostas antigas (o Renderer deve suportar múltiplas versões do contrato por um período de transição).
- **Versionamento de catálogo de estratégias:** `sales_strategy_catalog` é versionado como qualquer outro dado de sistema — novas estratégias podem ser adicionadas sem migração destrutiva, e fotógrafos que já configuraram estratégias antigas continuam funcionando.

---

## 29. Checklist de aceite

- [ ] Todas as tabelas de contexto (seção 18) criadas com RLS correta.
- [ ] `component_registry` e `layout_contract_rules` populados como seed data, somente leitura para fotógrafos.
- [ ] `sales_strategy_catalog` populado com as 6 estratégias documentadas (seção 8).
- [ ] Área **Comercial → Estratégia** no frontend permite preencher `BUSINESS_CONTEXT`, `AUDIENCE_CONTEXT`, `SALES_STRATEGY_CONTEXT` (seleção + peso + notas) e `DESIGN_PREFERENCES`.
- [ ] Context Assembler implementado como serviço isolado, gerando e persistindo `ai_context_snapshot` sem chamar nenhuma IA.
- [ ] `quote_versions.component_tree` validado contra um JSON Schema formal antes de salvar.
- [ ] Nenhuma tabela system-owned é editável via API pública/fotógrafo.
- [ ] `ai_generation_logs` existe e é usado mesmo para registrar edições manuais (fluxo de fallback), preparado para uso futuro por IA real.
- [ ] Hierarquia de prioridade (seção 16) documentada no código (comentários/README do serviço), não apenas neste documento.
- [ ] Nenhuma chamada a provedor de IA existe no código desta fase.

---

## 30. Decisões arquiteturais recomendadas

1. **Adotar geração declarativa/limitada (bounded generation) desde o desenho do schema**, mesmo antes de existir IA — porque o formato de dados que você desenha agora (`component_tree`, `props_schema`) é o que vai impedir HTML livre depois. Definir isso tarde exigiria retrabalho de todo o modelo de dados.
2. **Separar fisicamente "montar contexto" de "chamar IA"** em serviços/functions diferentes — garante trocar de provedor de IA no futuro sem tocar em regras de negócio, e permite testar/validar o Context Assembler isoladamente hoje.
3. **Tratar `LAYOUT_CONTRACT` e `COMPONENT_REGISTRY` como dados de sistema versionados, não como configuração de produto** — eles precisam de disciplina de release (como uma API pública), porque proposta antiga depende deles para continuar renderizando corretamente.
4. **Usar catálogo fechado + peso para estratégias de venda, com campo de notas livre para nuance** — evita tanto a rigidez de "escolha 1 de 4 templates" quanto o caos de texto livre sem estrutura nenhuma.
5. **Tratar estilo como atributos combináveis (seção 11), não como templates nomeados** — atende diretamente ao requisito de "não engessar" mantendo tudo traduzível para componentes existentes.
6. **Grounding obrigatório e explícito**: todo dado factual da proposta vem de uma referência a uma linha de banco de dados, nunca de texto solto gerado — isso deve ser um requisito de schema (campos como `services_ref`, não `services_text`), não apenas uma instrução de prompt.
7. **Registrar toda geração com snapshot + log**, mesmo antes de existir IA real — o hábito de versionar e auditar precisa nascer com o sistema, não ser adicionado depois.

---

## 31. O que NÃO deve ser implementado agora

Para evitar que o Antigravity (ou qualquer agente) antecipe fases posteriores:

- ❌ **Não integrar nenhum provedor de IA** (OpenAI, Anthropic, Gemini, etc.) nesta fase.
- ❌ **Não escrever a lógica de geração de proposta em si** (o "prompt de produção"). Este documento define o ambiente, não o comportamento fino do modelo.
- ❌ **Não construir o editor visual** (drag-and-drop, renderer de tela). Apenas o contrato de dados (`component_tree`) que ele vai consumir.
- ❌ **Não implementar aprendizado baseado em resultados / análise de conversão.** Os logs (seção 26) devem existir para viabilizar isso depois, mas a análise em si é fase futura.
- ❌ **Não implementar geração automática de follow-up.**
- ❌ **Não implementar roteamento entre múltiplos modelos de IA.**
- ❌ **Não permitir que o fotógrafo edite `component_registry` ou `layout_contract_rules` via interface.**
- ❌ **Não assumir preços ou condições padrão "genéricas do mercado"** para preencher lacunas — mesmo em modo de teste/demonstração, usar dados de exemplo explicitamente marcados como tal.
- ❌ **Não implementar histórico de conversas do WhatsApp como fonte de contexto automática** para a IA de propostas — isso depende de decisão explícita de permissão do fotógrafo e é integração cross-módulo para fase posterior.

O objetivo desta fase é **apenas** a fundação: dados, regras, contrato de contexto e contrato de componentes.

---

## 32. Referências consultadas

Pesquisa realizada para fundamentar as decisões arquiteturais deste documento (sem reprodução de texto, apenas síntese e aplicação dos princípios):

- Padrões de "structured/constrained output" e geração via JSON Schema em LLMs de produção.
- Arquiteturas de "Generative UI" (declarative/bounded generation vs. HTML livre), incluindo o padrão de catálogo de componentes pré-aprovados e validação de gateway antes de renderizar.
- Práticas de "context engineering" e hierarquia de autoridade de contexto (regras do sistema > dados recuperados > histórico de sessão > entrada do usuário) para redução de alucinação em agentes de IA.
- Técnicas de grounding via RAG e instrução explícita de "usar apenas o contexto fornecido" como redutor de fabricação de fatos.
- Metodologias comerciais (venda consultiva, venda por valor percebido, venda de alto ticket/exclusividade) e práticas de precificação para serviços fotográficos, usadas como base para o catálogo de estratégias da seção 8.

---

*Fim do documento. Próximo artefato: comando de implementação para o Antigravity (arquivo separado).*
