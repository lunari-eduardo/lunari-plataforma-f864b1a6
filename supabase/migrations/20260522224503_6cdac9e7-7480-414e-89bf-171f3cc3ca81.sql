CREATE TABLE IF NOT EXISTS public.user_theme_preferences (
  user_id uuid PRIMARY KEY,
  preset_id text NOT NULL DEFAULT 'lunari',
  mode text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_theme_preferences_mode_check CHECK (mode IN ('light','dark','system'))
);

ALTER TABLE public.user_theme_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own theme preference"
  ON public.user_theme_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own theme preference"
  ON public.user_theme_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own theme preference"
  ON public.user_theme_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own theme preference"
  ON public.user_theme_preferences FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_theme_preferences_updated_at
  BEFORE UPDATE ON public.user_theme_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();