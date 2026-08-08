# Comando para o Antigravity — Fundação do Motor de Contexto da IA de Orçamentos/Propostas (Lunari)

> Cole este comando diretamente para o Antigravity. Ele referencia o documento `lunari-ai-orcamentos-arquitetura.md`, que deve ser anexado/colado junto (ou salvo no repositório e referenciado por caminho) antes de enviar este comando.

---

## CONTEXTO

Você vai implementar a **fundação de backend** do módulo de Orçamentos/Propostas do Lunari, que futuramente será operado por uma IA. O documento anexo (`lunari-ai-orcamentos-arquitetura.md`) é a especificação de arquitetura, modelo de dados e regras — trate-o como fonte de verdade. Não reinterprete a estratégia comercial nem a arquitetura ali definida; se algo parecer ambíguo ou incompleto, pare e pergunte antes de decidir sozinho.

**Importante:** esta tarefa é sobre **estrutura, dados e regras** — não sobre inteligência artificial em si. Nenhuma chamada a provedor de IA deve existir ao final desta implementação.

---

## O QUE IMPLEMENTAR NESTA FASE

### 1. Modelo de dados (Supabase)
Implemente as tabelas descritas na **seção 18** do documento anexo, organizadas nos schemas sugeridos na **seção 27** (`commercial`, `crm`, `quoting`, `system`). Para cada tabela:
- Defina tipos e constraints reais (a documentação dá o formato conceitual; você deve traduzir para SQL/migration válido).
- Aplique RLS: fotógrafo só acessa seus próprios dados (`photographer_id`); tabelas `system.*` (`component_registry`, `layout_contract_rules`, `sales_strategy_catalog`) são somente leitura para usuários autenticados e só editáveis por uma role administrativa/interna.
- Adicione `updated_at` (trigger automático) em toda tabela de contexto configurável.

### 2. Seed data
- Popule `sales_strategy_catalog` com as **6 estratégias** descritas na seção 8.1 do documento (nome, descrição, objetivo, quando usar, cliente ideal, abordagem, riscos, exemplo, considerações da IA — todos os campos).
- Popule `component_registry` com os componentes descritos na seção 13 (`CoverBlock`, `TextSection`, `ServiceGrid`, `PricingTable`, `TestimonialBlock`, `Gallery`, `FAQBlock`, `CTABlock`, `FooterTerms`), cada um com `variants`, `props_schema` e `responsive_behavior` conforme os exemplos da seção 13.2 e as regras obrigatórias da seção 12.2. Se algum componente precisar de mais detalhe técnico do que o documento fornece, pergunte antes de inventar o schema sozinho.
- Popule `layout_contract_rules` com as 12 regras obrigatórias da seção 12.2, como registros estruturados (não apenas comentário/documentação) para que futuramente sejam consultáveis por código.

### 3. Área "Comercial → Estratégia" (frontend + API)
Implemente as telas/formulários e os endpoints/Edge Functions para o fotógrafo preencher:
- Identidade Comercial (`BUSINESS_CONTEXT`, seção 5)
- Marca (`BRAND_CONTEXT`, seção 6)
- Público (`AUDIENCE_CONTEXT`, seção 7) — deve suportar múltiplos perfis por fotógrafo
- Como eu vendo (`SALES_STRATEGY_CONTEXT`, seção 8.2) — seleção de uma ou mais estratégias do catálogo com peso (0–100%) e campo de notas livre
- Estilo (`DESIGN_PREFERENCES`, seção 11) — os atributos combináveis (density, tone_visual, typography_scale, image_dominance, whitespace_level, color_intensity, layout_energy, free_text_description), não uma lista fechada de templates

### 4. Context Assembler
Implemente como serviço/Edge Function isolado (`assemble-context`), cuja **única responsabilidade** é:
- Ler os contextos reais do fotógrafo, cliente e orçamento;
- Montar o payload conforme o formato da **seção 19**;
- Persistir esse payload em `ai_context_snapshots` (imutável, versionado com `context_version`);
- **Não chamar nenhum provedor de IA.** O resultado desta função é o snapshot salvo — nada além disso.

### 5. Validation Gate (estrutura, sem IA)
Implemente a função de validação que, dado um `component_tree` (seja ele produzido manualmente pelo fotógrafo agora, ou por IA no futuro), verifica:
- Conformidade com `component_registry` (tipos, variantes e props válidos);
- Conformidade com `layout_contract_rules`;
- Que todo dado factual referenciado (preço, serviço, cliente) existe de fato nas tabelas reais (nunca texto solto).

Use esta função desde já para validar edições manuais no editor de propostas — ela precisa estar pronta e testada antes de qualquer geração por IA existir.

### 6. Versionamento
Implemente `quote_versions` como histórico append-only (nunca update destrutivo de conteúdo) conforme seção 28, com `created_by` diferenciando `'ai'` de `'photographer'` (mesmo que `'ai'` ainda não seja usado nesta fase).

### 7. Logs
Implemente `ai_generation_logs` desde já, mesmo sem IA — use para registrar toda validação (sucesso/falha) de edições manuais no editor. Isso prepara o pipeline de auditoria para quando a geração por IA existir.

---

## LIMITES DESTA FASE — NÃO FAÇA

- ❌ Não integre nenhum provedor de IA (OpenAI, Anthropic, Gemini ou outro).
- ❌ Não escreva lógica de geração de proposta (prompt de produção, orquestração de modelo).
- ❌ Não construa o editor visual completo (renderer de tela, drag-and-drop) — apenas o contrato de dados que ele vai consumir (`component_tree`).
- ❌ Não implemente análise de conversão, aprendizado ou geração automática de follow-up.
- ❌ Não permita que o fotógrafo edite `component_registry`, `layout_contract_rules` ou `sales_strategy_catalog` via interface do produto.
- ❌ Não invente valores padrão "genéricos de mercado" para preencher lacunas de dados — campos sem dado real ficam explicitamente pendentes na UI.
- ❌ Não conecte o histórico de conversas do WhatsApp como fonte de contexto automática para este módulo.

Se em algum momento a implementação parecer exigir uma dessas coisas para "funcionar direito", pare e sinalize — é sinal de que o modelo de dados desta fase precisa de ajuste, não de que a regra deve ser quebrada.

---

## ORDEM DE EXECUÇÃO SUGERIDA

1. Migrations do modelo de dados (seção 1 acima) + RLS.
2. Seed data (seção 2 acima).
3. Context Assembler + persistência de snapshot (seção 4).
4. Validation Gate (seção 5), testada com `component_tree` criado manualmente.
5. Telas de "Comercial → Estratégia" (seção 3) — pode andar em paralelo com os itens 1–2.
6. Versionamento e logs (seções 6–7).
7. Checklist de aceite: rode item por item a lista da **seção 29** do documento de arquitetura antes de considerar esta fase concluída.

---

## ANTES DE COMEÇAR

Confirme que você:
1. Leu o documento `lunari-ai-orcamentos-arquitetura.md` por completo, especialmente as seções 12 (Responsive Layout Contract), 13 (Component Architecture) e 16 (Hierarquia de prioridade).
2. Entendeu que esta fase não inclui IA nenhuma — o objetivo é deixar o "ambiente" pronto para que, numa fase futura separada, a geração por IA seja plugada sem precisar redesenhar dados ou regras.
3. Vai perguntar antes de tomar decisões de schema não cobertas explicitamente pelo documento (em especial `props_schema` de componentes e `responsive_behavior` detalhado).

Se estiver tudo claro, proponha primeiro o plano de migrations (schemas, tabelas, campos, RLS) para revisão antes de codificar.
