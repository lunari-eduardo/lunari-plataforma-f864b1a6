-- Migration to add 'icone' column to fin_items_master
ALTER TABLE public.fin_items_master ADD COLUMN IF NOT EXISTS icone TEXT;

-- Update existing defaults with basic icons based on name
UPDATE public.fin_items_master SET icone = 'home' WHERE nome = 'Aluguel' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'zap' WHERE nome = 'Energia' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'droplet' WHERE nome = 'Água' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'wifi' WHERE nome = 'Internet' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'shopping-bag' WHERE nome = 'Insumos' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'car' WHERE nome = 'Transporte' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'megaphone' WHERE nome = 'Marketing' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'camera' WHERE nome = 'Equipamentos' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'laptop' WHERE nome = 'Software' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'receipt' WHERE nome = 'Impostos' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'users' WHERE nome = 'Equipe' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'briefcase' WHERE nome = 'Contabilidade' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'building' WHERE nome = 'Locação de Espaço/Equipamentos' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'wallet' WHERE nome = 'Vendas de Equipamentos' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'piggy-bank' WHERE nome = 'Receita Extra' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'image' WHERE nome = 'Venda de Fotos' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'package' WHERE nome = 'Fotolivro' AND icone IS NULL;
UPDATE public.fin_items_master SET icone = 'folder-open' WHERE nome = 'Acervo' AND icone IS NULL;

-- Set a default fallback icon for any remaining items
UPDATE public.fin_items_master SET icone = 'tag' WHERE icone IS NULL;
