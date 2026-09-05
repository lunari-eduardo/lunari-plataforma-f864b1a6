import { User, Image, MessageSquare, Sparkles } from 'lucide-react';
import React from 'react';

export interface StepItem {
  id: number;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const DELIVER_STEPS: StepItem[] = [
  { id: 1, name: 'Dados', icon: User },
  { id: 2, name: 'Visual', icon: Sparkles },
  { id: 3, name: 'Fotos', icon: Image },
  { id: 4, name: 'Mensagem', icon: MessageSquare },
];
