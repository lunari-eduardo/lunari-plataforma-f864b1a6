import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface TaskSimpleFormProps {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
}

export default function TaskSimpleForm({ title, setTitle, description, setDescription }: TaskSimpleFormProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="title">Título *</Label>
        <Input 
          id="title" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          required 
          placeholder="Ex.: Ligar para cliente João" 
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Textarea 
          id="description" 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          placeholder="Detalhes do que deve ser feito"
          rows={3}
        />
      </div>
    </>
  );
}