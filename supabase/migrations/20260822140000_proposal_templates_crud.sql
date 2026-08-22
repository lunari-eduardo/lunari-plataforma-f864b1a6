-- ============================================================
-- COMERCIAL: TEMPLATES DE PROPOSTA EDITÁVEIS
-- 1. Coluna thumbnail_url para a galeria do wizard
-- 2. Policies de escrita para admins (salvar/gerenciar modelos pela UI)
-- 3. Novos seeds (Clássico e Clean) além do "Editorial Sofisticado"
-- ============================================================

ALTER TABLE public.proposal_templates
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Escrita restrita a admins (o módulo comercial é admin-only)
DROP POLICY IF EXISTS "Admins can manage proposal templates" ON public.proposal_templates;

CREATE POLICY "Admins can manage proposal templates"
  ON public.proposal_templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- SEED: Clássico Convidativo (tons quentes, terracota)
-- ============================================================
INSERT INTO public.proposal_templates (template_id, name, description, tags, blocks_json, design_tokens, thumbnail_url)
VALUES (
  'proposta-modelo-classico',
  'Clássico Convidativo',
  'Tons quentes e terracota, texto acolhedor e tabela de pacotes direta.',
  ARRAY['classico', 'acolhedor', 'terracota'],
  '[
    {"id":"cc_cover","type":"CoverBlock","content":{"eyebrow":"Proposta personalizada","title":"Um registro para","title_italic":"sempre lembrar.","subtitle":"Fotografias que eternizam o seu momento com leveza, verdade e emoção.","photographer_name":"","btnText":"Quero viver essa experiência","btnLink":"","image_url":""}},
    {"id":"cc_editorial","type":"EditorialBlock","props":{"background":"cream","photo_a":{"width_pct":72,"height_pct":80,"image_ref":null},"photo_b":{"width_pct":62,"height_pct":66,"image_ref":null}},"content":{"eyebrow":"Como funciona","title":"Uma tarde","title_italic":"só sua.","details":[{"id":"d1","label":"Duração","value":"2 a 8 horas"},{"id":"d2","label":"Local","value":"Estúdio ou externo"},{"id":"d3","label":"Entrega","value":"7 a 15 dias úteis"},{"id":"d4","label":"Fotos editadas","value":"20 a 100 imagens"}],"body":"Cada sessão começa com uma conversa sobre o que você quer guardar. Sem pressa, sem poses ensaiadas — apenas o seu momento e a luz certa para ele.","vertical_label":""}},
    {"id":"cc_pricing","type":"PricingTable","content":{"eyebrow":"Investimento","title":"Pacotes","packages":[{"id":"p1","name":"Essencial","price":"R$ 890","price_unit":"sessão","badge":"","features":["2 horas de cobertura","20 fotos editadas","Galeria online privada"]},{"id":"p2","name":"Clássico","price":"R$ 1.490","price_unit":"sessão","badge":"O mais escolhido","features":["4 horas de cobertura","50 fotos editadas","Galeria online privada","2 impressões 30×40"]},{"id":"p3","name":"Premium","price":"R$ 2.800","price_unit":"sessão","badge":"","features":["8 horas de cobertura","100 fotos editadas","Galeria + pendrive","Álbum impresso 30×30"]}]}},
    {"id":"cc_cta","type":"CTABlock","content":{"cta_text":"Vamos conversar?","links":[]}},
    {"id":"cc_footer","type":"FooterTerms","content":{"copyright":"© Todos os direitos reservados"}}
  ]'::jsonb,
  '{"colors":{"cream":"#FDFBF7","linen":"#F0E9E1","stone":"#D8C7B8","taupe":"#8A7364","accent":"#C86A46","ink":"#2C2825","white":"#FFFFFF"},"typography":{"display":"Playfair Display","body":"Inter"}}'::jsonb,
  NULL
)
ON CONFLICT (template_id) DO NOTHING;

-- ============================================================
-- SEED: Clean Minimal (claro, neutro, cinza pedra)
-- ============================================================
INSERT INTO public.proposal_templates (template_id, name, description, tags, blocks_json, design_tokens, thumbnail_url)
VALUES (
  'proposta-modelo-clean',
  'Clean Minimal',
  'Layout claro e neutro, tipografia limpa, foco total no conteúdo.',
  ARRAY['clean', 'minimal', 'claro'],
  '[
    {"id":"cm_cover","type":"CoverBlock","content":{"eyebrow":"Proposta","title":"Simples,","title_italic":"direto e seu.","subtitle":"Uma experiência de fotografia sem excessos, com entrega cuidadosa.","photographer_name":"","btnText":"Quero saber mais","btnLink":"","image_url":""}},
    {"id":"cm_editorial","type":"EditorialBlock","props":{"background":"white","photo_a":{"width_pct":72,"height_pct":80,"image_ref":null},"photo_b":{"width_pct":62,"height_pct":66,"image_ref":null}},"content":{"eyebrow":"Sobre","title":"Menos pose,","title_italic":"mais você.","details":[{"id":"d1","label":"Duração","value":"1 a 4 horas"},{"id":"d2","label":"Entrega","value":"até 10 dias úteis"}],"body":"Trabalho com uma abordagem discreta: observo, acompanho e registro o que acontece de verdade. O resultado é um conjunto honesto de imagens que não envelhece.","vertical_label":""}},
    {"id":"cm_pricing","type":"PricingTable","content":{"eyebrow":"Valores","title":"Pacotes","packages":[{"id":"p1","name":"Básico","price":"R$ 690","price_unit":"sessão","badge":"","features":["1h de cobertura","15 fotos editadas","Galeria online"]},{"id":"p2","name":"Completo","price":"R$ 1.190","price_unit":"sessão","badge":"","features":["3h de cobertura","40 fotos editadas","Galeria online","Miniálbum 15×15"]}]}},
    {"id":"cm_cta","type":"CTABlock","content":{"cta_text":"Bora tirar isso do papel?","links":[]}},
    {"id":"cm_footer","type":"FooterTerms","content":{"copyright":"© Todos os direitos reservados"}}
  ]'::jsonb,
  '{"colors":{"cream":"#FAFAF8","linen":"#EFEFEC","stone":"#C4C4C0","taupe":"#6E6E6A","accent":"#4A4A46","ink":"#212121","white":"#FFFFFF"},"typography":{"display":"Playfair Display","body":"Inter"}}'::jsonb,
  NULL
)
ON CONFLICT (template_id) DO NOTHING;
