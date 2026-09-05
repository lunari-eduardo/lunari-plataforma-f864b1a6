import { ComponentType } from 'react';
import { User, Tag, Settings, Image, MessageSquare, Check } from 'lucide-react';

export interface StepItem {
  id: number;
  name: string;
  icon: ComponentType<{ className?: string }>;
}

export const GALLERY_CREATE_STEPS: StepItem[] = [
  { id: 1, name: 'Cliente', icon: User },
  { id: 2, name: 'Venda', icon: Tag },
  { id: 3, name: 'Configurações', icon: Settings },
  { id: 4, name: 'Fotos', icon: Image },
  { id: 5, name: 'Mensagem', icon: MessageSquare },
  { id: 6, name: 'Revisão', icon: Check },
];
