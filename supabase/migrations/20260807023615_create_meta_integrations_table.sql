CREATE TABLE IF NOT EXISTS public.meta_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    app_id TEXT,
    system_user_access_token TEXT NOT NULL,
    phone_number_id TEXT NOT NULL,
    waba_id TEXT,
    webhook_verify_token TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.meta_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own meta integrations"
    ON public.meta_integrations
    FOR ALL
    USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_meta_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meta_integrations_updated_at
    BEFORE UPDATE ON public.meta_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_meta_integrations_updated_at();
