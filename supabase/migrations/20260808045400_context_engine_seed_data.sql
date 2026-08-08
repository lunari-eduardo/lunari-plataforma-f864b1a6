-- ==========================================
-- SEED DATA: system.sales_strategy_catalog
-- ==========================================

INSERT INTO system.sales_strategy_catalog (strategy_key, name, description, objective, when_to_use, ideal_client, communication_approach, risks, ai_considerations) VALUES
(
    'valor_percebido',
    'Venda por Valor Percebido',
    'O texto ancora o preço em benefícios tangíveis e intangíveis específicos, para que o valor pareça superior ao número cobrado.',
    'Reduzir a sensação de "caro" transformando preço em investimento justificado.',
    'Quando o ticket é médio/alto e o cliente compara concorrentes por preço.',
    'Racional, pesquisa antes de decidir, sensível a preço mas aberto a argumento.',
    'Listar entregáveis concretos + resultado emocional/prático de cada um; evitar apenas listar itens sem conectar a benefício.',
    'Parecer uma lista de vendas agressiva se usada sem equilíbrio com confiança.',
    'Apenas itens reais do catálogo de serviços; nunca inflacionar benefícios não confirmados pelo fotógrafo.'
),
(
    'experiencia',
    'Venda por Experiência',
    'O foco está em como será o processo de ser fotografado, não apenas no resultado final.',
    'Vender a jornada — atendimento, cuidado, ambiente — como parte do produto.',
    'Serviços com forte componente de atendimento (ensaios guiados, sessões em estúdio, eventos).',
    'Valoriza conforto, quer se sentir cuidado, decide por percepção de atendimento.',
    'Narrativa em primeira pessoa do que o cliente vai viver; menos tabela, mais storytelling.',
    'Pode soar vago se não houver dados reais de processo para ancorar.',
    'Só descrever etapas do processo que o fotógrafo de fato configurou; nunca inventar roteiro.'
),
(
    'exclusividade',
    'Venda por Exclusividade e Posicionamento',
    'Comunica escassez legítima, seletividade e posicionamento premium.',
    'Justificar ticket alto pela raridade da vaga/atenção, não apenas pelo produto.',
    'Exclusivity_level alto, agenda limitada real, portfólio autoral forte.',
    'Menos sensível a preço, sensível a status e curadoria.',
    'Tom mais contido, menos "venda", mais convite; frases curtas, muito espaço em branco.',
    'Escassez falsa (vagas limitadas que não existem de verdade).',
    'Só menciona limitação de agenda se houver campo real de disponibilidade preenchido; do contrário, omite.'
),
(
    'seguranca_confianca',
    'Venda por Segurança e Confiança',
    'Reduz risco percebido do cliente através de prova social real, garantias e clareza de processo.',
    'Neutralizar objeções de confiança.',
    'Público iniciante na categoria ou alta sensibilidade a risco.',
    'Cauteloso, pesquisa avaliações, quer garantias explícitas.',
    'Depoimentos reais, política clara de entrega/revisão, linguagem transparente sobre prazos.',
    'Nunca gerar depoimentos falsos ou avaliações que não existam.',
    'Só usa depoimentos cadastrados; se não houver nenhum, omite o bloco.'
),
(
    'transformacao_resultado',
    'Venda por Transformação e Resultado',
    'Foca no "antes e depois" — o que muda na vida do cliente com aquele registro.',
    'Conectar a fotografia a um resultado maior que a própria imagem.',
    'Fotografia de família, newborn, corporativo, pessoal branding.',
    'Motivado por propósito/significado mais do que por estética isolada.',
    'Linguagem sobre legado, memória, impacto; menos técnica, mais emocional.',
    'Exagero emocional sem lastro; deve equilibrar com fatos concretos do serviço.',
    'O propósito declarado deve vir do briefing do cliente, não ser genérico.'
),
(
    'venda_consultiva',
    'Venda Consultiva',
    'A proposta é apresentada como resultado de um diagnóstico, não como oferta padrão.',
    'Criar percepção de "feito sob medida" através de espelhamento do briefing.',
    'Quando existe briefing rico do cliente (reunião, formulário, conversa prévia).',
    'Decisor racional, valoriza ser ouvido, compara propostas por adequação e não só por preço.',
    'Abrir citando/parafraseando a necessidade relatada pelo cliente, depois conectar com a solução.',
    'Exige briefing real preenchido — sem isso, a estratégia não deve ser aplicada.',
    'Nunca reformula o briefing de um jeito que mude seu sentido original; se o briefing estiver vazio, a estratégia consultiva fica indisponível.'
);

-- ==========================================
-- SEED DATA: system.layout_contract_rules
-- ==========================================

INSERT INTO system.layout_contract_rules (rule_key, description, rule_definition) VALUES
('no_fixed_heights', 'Nenhuma altura fixa em pixels para blocos de conteúdo. Sempre min-height + conteúdo fluido.', '{"enforcement": "css_validation", "target": "block_containers"}'::jsonb),
('focal_point_required', 'Toda imagem de fundo/capa precisa de focal_point para recorte inteligente.', '{"enforcement": "schema_validation", "target": "images_with_cover_behavior"}'::jsonb),
('text_overlay_contrast', 'Todo texto sobre imagem exige overlay/scrim configurado com contraste mínimo garantido.', '{"enforcement": "schema_validation", "target": "text_on_image"}'::jsonb),
('mobile_single_column', 'Grids colapsam para coluna única em mobile. Ordem definida por priority.', '{"enforcement": "css_validation", "target": "grid_containers"}'::jsonb),
('stacking_fallback', 'Elementos absolutos exigem stacking fallback definido em mobile.', '{"enforcement": "css_validation", "target": "absolute_positioned_elements"}'::jsonb),
('fluid_typography', 'Tipografia usa escala fluida (clamp), nunca px fixo.', '{"enforcement": "token_validation", "target": "typography"}'::jsonb),
('no_hover_dependency', 'Nenhum conteúdo essencial pode depender apenas de hover.', '{"enforcement": "ux_validation", "target": "interactive_elements"}'::jsonb),
('no_hidden_overflow', 'Overflow de texto nunca é hidden sem alternativa (ver mais).', '{"enforcement": "css_validation", "target": "text_blocks"}'::jsonb),
('explicit_breakpoints', 'Todo componente precisa declarar seu comportamento nos 3 breakpoints.', '{"enforcement": "schema_validation", "target": "components"}'::jsonb),
('touch_target_size', 'Área de toque mínima de 44x44px para elementos interativos.', '{"enforcement": "css_validation", "target": "buttons_links"}'::jsonb),
('safe_areas_mobile', 'Margens mínimas laterais garantidas em mobile (safe areas).', '{"enforcement": "css_validation", "target": "containers"}'::jsonb),
('complex_layout_fallback', 'Composição complexa/editorial precisa de variante linear para mobile.', '{"enforcement": "schema_validation", "target": "complex_variants"}'::jsonb);

-- ==========================================
-- SEED DATA: system.component_registry
-- ==========================================

INSERT INTO system.component_registry (type, variants, props_schema, responsive_behavior, content_slots) VALUES
(
    'CoverBlock',
    '["full_bleed_image", "split_image_text", "minimal_typographic"]'::jsonb,
    '{"image_ref": {"type": "string"}, "focal_point": {"type": "object", "properties": {"x": "number", "y": "number"}}, "overlay_intensity": {"type": "enum", "values": ["none", "light", "medium", "strong"]}, "typography_scale_token": {"type": "enum", "values": ["discreta", "equilibrada", "impactante"]}, "alignment": {"type": "enum", "values": ["left", "center", "right"]}}'::jsonb,
    '{"mobile": {"layout": "stack"}, "tablet": {"layout": "variant_dependent"}, "desktop": {"layout": "variant_dependent"}}'::jsonb,
    '["title", "subtitle", "cta_label"]'::jsonb
),
(
    'TextSection',
    '["standard", "caption_only", "quote_style"]'::jsonb,
    '{"alignment": {"type": "enum", "values": ["left", "center", "right"]}, "text_size": {"type": "enum", "values": ["small", "medium", "large"]}}'::jsonb,
    '{"mobile": {"layout": "single_column"}, "tablet": {"layout": "single_column"}, "desktop": {"layout": "single_column"}}'::jsonb,
    '["heading", "body_text"]'::jsonb
),
(
    'ServiceGrid',
    '["cards_2col", "cards_3col", "list_view"]'::jsonb,
    '{"priority_mobile_order": {"type": "array"}, "corner_radius_token": {"type": "enum", "values": ["none", "small", "large"]}}'::jsonb,
    '{"mobile": {"layout": "single_column_stack"}, "tablet": {"layout": "2_columns"}, "desktop": {"layout": "3_columns"}}'::jsonb,
    '["services_ref"]'::jsonb
),
(
    'PricingTable',
    '["single_column", "comparison_3col"]'::jsonb,
    '{"highlight_package_id": {"type": "string"}}'::jsonb,
    '{"mobile": {"layout": "vertical_stack"}, "tablet": {"layout": "horizontal_scroll_or_stack"}, "desktop": {"layout": "columns"}}'::jsonb,
    '["packages_ref", "features_list"]'::jsonb
),
(
    'TestimonialBlock',
    '["carousel", "grid", "single_featured"]'::jsonb,
    '{"show_photos": {"type": "boolean"}}'::jsonb,
    '{"mobile": {"layout": "carousel_or_stack"}, "tablet": {"layout": "grid_or_carousel"}, "desktop": {"layout": "grid_or_carousel"}}'::jsonb,
    '["testimonials_ref"]'::jsonb
),
(
    'Gallery',
    '["masonry", "grid", "full_width_stack"]'::jsonb,
    '{"gap_size": {"type": "enum", "values": ["none", "small", "medium"]}}'::jsonb,
    '{"mobile": {"layout": "1_or_2_columns"}, "tablet": {"layout": "2_or_3_columns"}, "desktop": {"layout": "3_or_4_columns"}}'::jsonb,
    '["images_ref"]'::jsonb
),
(
    'FAQBlock',
    '["accordion", "list"]'::jsonb,
    '{}'::jsonb,
    '{"mobile": {"layout": "accordion"}, "tablet": {"layout": "accordion_or_columns"}, "desktop": {"layout": "accordion_or_columns"}}'::jsonb,
    '["questions_and_answers"]'::jsonb
),
(
    'CTABlock',
    '["standard", "floating_bar"]'::jsonb,
    '{"button_style": {"type": "enum", "values": ["solid", "outline", "text"]}}'::jsonb,
    '{"mobile": {"layout": "full_width_button"}, "tablet": {"layout": "auto_width"}, "desktop": {"layout": "auto_width"}}'::jsonb,
    '["title", "button_label", "button_link"]'::jsonb
),
(
    'FooterTerms',
    '["standard", "minimal"]'::jsonb,
    '{}'::jsonb,
    '{"mobile": {"layout": "stack"}, "tablet": {"layout": "row"}, "desktop": {"layout": "row"}}'::jsonb,
    '["terms_text", "company_info"]'::jsonb
);
