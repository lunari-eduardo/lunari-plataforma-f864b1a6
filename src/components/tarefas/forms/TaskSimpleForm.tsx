import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import RichTextEditor from '@/components/ui/rich-text-editor';

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
        <RichTextEditor 
          value={description} 
          onChange={setDescription} 
          placeholder="Detalhes do que deve ser feito"
          minHeight="120px"
        />
      </div>
    </>
  );
}