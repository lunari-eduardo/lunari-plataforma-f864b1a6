import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { VisualThemeConfig, ThemePresetId, VisualThemeMode } from '@/lib/visualTheme';

/**
 * Persiste o tema do usuário em `user_theme_preferences`.
 * - fetch ao logar
 * - upsert debounced ao mudar
 */
export function useRemoteThemeSync(
  theme: VisualThemeConfig,
  applyRemote: (next: VisualThemeConfig) => void,
) {
  const lastSavedRef = useRef<string>('');
  const debounceRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);

  // Hidrata do Supabase quando o usuário estiver autenticado
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data, error } = await supabase
        .from('user_theme_preferences')
        .select('preset_id, mode')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled || error || !data) { hydratedRef.current = true; return; }
      const next: VisualThemeConfig = {
        presetId: data.preset_id as ThemePresetId,
        mode: data.mode as VisualThemeMode,
      };
      lastSavedRef.current = JSON.stringify(next);
      hydratedRef.current = true;
      applyRemote(next);
    };
    hydrate();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') hydrate();
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Upsert debounced quando o tema muda
  useEffect(() => {
    if (!hydratedRef.current) return;
    const serialized = JSON.stringify(theme);
    if (serialized === lastSavedRef.current) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('user_theme_preferences')
        .upsert({
          user_id: user.id,
          preset_id: theme.presetId,
          mode: theme.mode,
        }, { onConflict: 'user_id' });
      if (!error) lastSavedRef.current = serialized;
    }, 400);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [theme]);
}
