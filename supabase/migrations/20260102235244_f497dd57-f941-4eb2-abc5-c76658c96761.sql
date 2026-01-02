-- Adicionar constraint UNIQUE em user_id para permitir upsert
ALTER TABLE public.lead_follow_up_config 
ADD CONSTRAINT lead_follow_up_config_user_id_unique UNIQUE (user_id);