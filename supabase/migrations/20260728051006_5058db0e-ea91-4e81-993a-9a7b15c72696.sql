-- Onda 8 — Enforcement do preset único "graphite" em user_profiles.preferencias
-- Guarda: só executa se a tabela e a coluna existirem no schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'preferencias'
  ) THEN
    -- 1) Força presetId = 'graphite' onde ainda estiver ausente ou legado.
    UPDATE public.user_profiles
       SET preferencias = jsonb_set(
             COALESCE(preferencias, '{}'::jsonb),
             '{tema,presetId}',
             '"graphite"'::jsonb,
             true
           )
     WHERE COALESCE(preferencias->'tema'->>'presetId', '') <> 'graphite';

    -- 2) Remove chaves obsoletas do color picker antigo.
    UPDATE public.user_profiles
       SET preferencias = preferencias
             #- '{tema,corPrimaria}'
             #- '{tema,temaCor}'
             #- '{tema,temaCorHex}'
     WHERE preferencias ? 'tema'
       AND (
            preferencias->'tema' ? 'corPrimaria'
         OR preferencias->'tema' ? 'temaCor'
         OR preferencias->'tema' ? 'temaCorHex'
       );
  END IF;
END $$;