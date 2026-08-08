-- 1. Create Schemas
CREATE SCHEMA IF NOT EXISTS system;
CREATE SCHEMA IF NOT EXISTS commercial;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS quoting;

-- Grant usage
GRANT USAGE ON SCHEMA system TO authenticated;
GRANT USAGE ON SCHEMA commercial TO authenticated;
GRANT USAGE ON SCHEMA crm TO authenticated;
GRANT USAGE ON SCHEMA quoting TO authenticated;
GRANT USAGE ON SCHEMA system TO anon;
GRANT USAGE ON SCHEMA commercial TO anon;
GRANT USAGE ON SCHEMA crm TO anon;
GRANT USAGE ON SCHEMA quoting TO anon;

-- ==========================================
-- SCHEMA: system
-- ==========================================

CREATE TABLE system.component_registry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL,
    variants jsonb NOT NULL DEFAULT '[]'::jsonb,
    props_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
    responsive_behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
    content_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
    version text NOT NULL DEFAULT '1.0',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE system.layout_contract_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key text NOT NULL UNIQUE,
    description text NOT NULL,
    rule_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
    version text NOT NULL DEFAULT '1.0',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE system.sales_strategy_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_key text NOT NULL UNIQUE,
    name text NOT NULL,
    description text NOT NULL,
    objective text NOT NULL,
    when_to_use text,
    ideal_client text,
    communication_approach text,
    risks text,
    ai_considerations text,
    version text NOT NULL DEFAULT '1.0',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for system
ALTER TABLE system.component_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.layout_contract_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.sales_strategy_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for authenticated users on component_registry" ON system.component_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users on layout_contract_rules" ON system.layout_contract_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users on sales_strategy_catalog" ON system.sales_strategy_catalog FOR SELECT TO authenticated USING (true);

-- ==========================================
-- SCHEMA: commercial
-- ==========================================

CREATE TABLE commercial.photographer_business_context (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    positioning_statement text,
    value_proposition text,
    differentiators jsonb DEFAULT '[]'::jsonb,
    desired_perception text,
    exclusivity_level int CHECK (exclusivity_level >= 1 AND exclusivity_level <= 5),
    ideal_client_profile text,
    ticket_range text,
    experience_type jsonb DEFAULT '[]'::jsonb,
    version int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commercial.brand_context (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_name text,
    tone_of_voice jsonb DEFAULT '[]'::jsonb,
    preferred_vocabulary jsonb DEFAULT '[]'::jsonb,
    forbidden_words jsonb DEFAULT '[]'::jsonb,
    formality_level int CHECK (formality_level >= 1 AND formality_level <= 5),
    logo_asset_id uuid,
    color_tokens jsonb DEFAULT '{}'::jsonb,
    typography_tokens jsonb DEFAULT '{}'::jsonb,
    version int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commercial.audience_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    segment_name text NOT NULL,
    age_range text,
    life_moment text,
    needs jsonb DEFAULT '[]'::jsonb,
    desires jsonb DEFAULT '[]'::jsonb,
    concerns jsonb DEFAULT '[]'::jsonb,
    common_objections jsonb DEFAULT '[]'::jsonb,
    decision_drivers jsonb DEFAULT '[]'::jsonb,
    price_sensitivity int CHECK (price_sensitivity >= 1 AND price_sensitivity <= 5),
    expected_experience text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commercial.photographer_sales_strategy_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    selected_strategies jsonb DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commercial.design_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scope text NOT NULL CHECK (scope IN ('default', 'quote_override')),
    quote_id uuid, -- FK added later to avoid circular dependency if needed, or point to quoting schema
    density int CHECK (density >= 1 AND density <= 5),
    tone_visual jsonb DEFAULT '[]'::jsonb,
    typography_scale text,
    image_dominance int CHECK (image_dominance >= 1 AND image_dominance <= 5),
    whitespace_level int CHECK (whitespace_level >= 1 AND whitespace_level <= 5),
    color_intensity int CHECK (color_intensity >= 1 AND color_intensity <= 5),
    layout_energy text,
    free_text_description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commercial.service_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    category text,
    deliverables jsonb DEFAULT '[]'::jsonb,
    process_steps jsonb DEFAULT '[]'::jsonb,
    price numeric,
    price_unit text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for commercial
ALTER TABLE commercial.photographer_business_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial.brand_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial.audience_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial.photographer_sales_strategy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial.design_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_business" ON commercial.photographer_business_context FOR ALL USING (photographer_id = auth.uid());
CREATE POLICY "owner_brand" ON commercial.brand_context FOR ALL USING (photographer_id = auth.uid());
CREATE POLICY "owner_audience" ON commercial.audience_profiles FOR ALL USING (photographer_id = auth.uid());
CREATE POLICY "owner_sales_strategy" ON commercial.photographer_sales_strategy_config FOR ALL USING (photographer_id = auth.uid());
CREATE POLICY "owner_design" ON commercial.design_preferences FOR ALL USING (photographer_id = auth.uid());
CREATE POLICY "owner_catalog" ON commercial.service_catalog FOR ALL USING (photographer_id = auth.uid());

-- ==========================================
-- SCHEMA: crm
-- ==========================================

CREATE TABLE crm.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    contact_info jsonb DEFAULT '{}'::jsonb,
    relationship_history text,
    lead_source text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm.client_briefings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    identified_need text,
    briefing_answers jsonb DEFAULT '{}'::jsonb,
    budget_signal text,
    preferences text,
    objections_raised jsonb DEFAULT '[]'::jsonb,
    purchase_moment text,
    photographer_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.client_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_clients" ON crm.clients FOR ALL USING (photographer_id = auth.uid());
CREATE POLICY "owner_briefings" ON crm.client_briefings FOR ALL USING (photographer_id = auth.uid());

-- ==========================================
-- SCHEMA: quoting
-- ==========================================

CREATE TABLE quoting.quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('rascunho', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada')),
    validity_period date,
    payment_conditions_ref uuid,
    current_version_id uuid, -- FK added below
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quoting.ai_context_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id uuid NOT NULL REFERENCES quoting.quotes(id) ON DELETE CASCADE,
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payload jsonb NOT NULL,
    context_version text NOT NULL,
    session_instructions jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quoting.quote_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id uuid NOT NULL REFERENCES quoting.quotes(id) ON DELETE CASCADE,
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version_number int NOT NULL,
    ai_context_snapshot_id uuid REFERENCES quoting.ai_context_snapshots(id) ON DELETE SET NULL,
    component_tree jsonb NOT NULL,
    change_summary text,
    created_by text NOT NULL CHECK (created_by IN ('ai', 'photographer')),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quoting.quotes ADD CONSTRAINT quotes_current_version_fk FOREIGN KEY (current_version_id) REFERENCES quoting.quote_versions(id) ON DELETE SET NULL;
ALTER TABLE commercial.design_preferences ADD CONSTRAINT design_quote_fk FOREIGN KEY (quote_id) REFERENCES quoting.quotes(id) ON DELETE CASCADE;

CREATE TABLE quoting.ai_generation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_context_snapshot_id uuid NOT NULL REFERENCES quoting.ai_context_snapshots(id) ON DELETE CASCADE,
    photographer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_output jsonb,
    validation_result jsonb,
    conflicts_resolved jsonb DEFAULT '[]'::jsonb,
    fields_left_pending jsonb DEFAULT '[]'::jsonb,
    status text NOT NULL CHECK (status IN ('success', 'validation_failed', 'retried')),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quoting.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quoting.ai_context_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE quoting.quote_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quoting.ai_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_quotes" ON quoting.quotes FOR ALL USING (photographer_id = auth.uid());
CREATE POLICY "owner_snapshots_select" ON quoting.ai_context_snapshots FOR SELECT USING (photographer_id = auth.uid());
CREATE POLICY "owner_snapshots_insert" ON quoting.ai_context_snapshots FOR INSERT WITH CHECK (photographer_id = auth.uid());
CREATE POLICY "owner_versions_select" ON quoting.quote_versions FOR SELECT USING (photographer_id = auth.uid());
CREATE POLICY "owner_versions_insert" ON quoting.quote_versions FOR INSERT WITH CHECK (photographer_id = auth.uid());
CREATE POLICY "owner_logs_select" ON quoting.ai_generation_logs FOR SELECT USING (photographer_id = auth.uid());
CREATE POLICY "owner_logs_insert" ON quoting.ai_generation_logs FOR INSERT WITH CHECK (photographer_id = auth.uid());

-- Indexes for quoting
CREATE INDEX idx_quotes_client ON quoting.quotes(client_id);
CREATE INDEX idx_versions_quote ON quoting.quote_versions(quote_id);
CREATE INDEX idx_snapshots_quote ON quoting.ai_context_snapshots(quote_id);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_photographer_business_context_updated_at BEFORE UPDATE ON commercial.photographer_business_context FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_brand_context_updated_at BEFORE UPDATE ON commercial.brand_context FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_audience_profiles_updated_at BEFORE UPDATE ON commercial.audience_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_photographer_sales_strategy_config_updated_at BEFORE UPDATE ON commercial.photographer_sales_strategy_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_design_preferences_updated_at BEFORE UPDATE ON commercial.design_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_service_catalog_updated_at BEFORE UPDATE ON commercial.service_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_clients_updated_at BEFORE UPDATE ON crm.clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_client_briefings_updated_at BEFORE UPDATE ON crm.client_briefings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_quotes_updated_at BEFORE UPDATE ON quoting.quotes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
