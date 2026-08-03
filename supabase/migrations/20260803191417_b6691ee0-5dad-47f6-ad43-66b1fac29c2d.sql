-- Consolidar colunas de retenção na tabela profiles
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'account_status') THEN
        ALTER TABLE public.profiles ADD COLUMN account_status text DEFAULT 'active' CHECK (account_status IN ('active', 'pending_deletion', 'suspended'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'deletion_requested_at') THEN
        ALTER TABLE public.profiles ADD COLUMN deletion_requested_at timestamptz;
    END IF;
END $$;

GRANT ALL ON public.profiles TO service_role;

CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status) WHERE account_status != 'active';
