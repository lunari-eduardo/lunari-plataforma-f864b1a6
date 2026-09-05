export function formatWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  let numbers = phone.replace(/\D/g, '');
  if (numbers.length === 0) return '';
  if (!numbers.startsWith('55') && numbers.length <= 11) {
    numbers = '55' + numbers;
  }
  const dddStr = numbers.substring(2, 4);
  const localNumber = numbers.substring(4);
  const ddd = parseInt(dddStr, 10);
  if (ddd > 28 && localNumber.length === 9 && localNumber.startsWith('9')) {
    return '55' + dddStr + localNumber.substring(1);
  }
  return numbers;
}

export type Categoria = {
  id: string;
  nome: string;
  cor: string | null;
};

export type DbTemplate = {
  id: string;
  template_id: string;
  name: string;
  description: string;
  tags: string[];
  preview_html_path: string;
};

export type Step = 'category' | 'method' | 'template-gallery' | 'pdf-upload' | 'ai-briefing';

export const SESSION_TYPES = [
  'Ensaio Gestante',
  'Casamento',
  'Newborn',
  'Família',
  'Aniversário',
  'Ensaios de Casal',
  'Corporativo',
  'Produto',
  'Outro',
];

export const TONES = ['Acolhedor', 'Sofisticado', 'Divertido', 'Minimalista', 'Poético'];

export type AiRef = {
  id: string;
  name: string;
  kind: 'image' | 'pdf' | 'text';
  url?: string;
  content?: string;
  mime: string;
};
