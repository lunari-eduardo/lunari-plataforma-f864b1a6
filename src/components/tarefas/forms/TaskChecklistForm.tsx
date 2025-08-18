import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Copy } from 'lucide-react';
import type { ChecklistItem } from '@/types/tasks';

interface TaskChecklistFormProps {
  title: string;
  setTitle: (value: string) => void;
  checklistItems: ChecklistItem[];
  setChecklistItems: (value: ChecklistItem[]) => void;
}

const DEFAULT_CHECKLISTS = {
  'edicao-fotos': [
    'Ajuste de exposição e contraste',
    'Correção de cores e balanço de branco',
    'Retoque básico de pele',
    'Remoção de elementos indesejados',
    'Aplicação de filtros e estilo',
    'Redimensionamento para web',
    'Exportação em alta resolução'
  ],
  'atendimento-cliente': [
    'Primeiro contato via WhatsApp',
    'Envio de portfólio e valores',
    'Agendamento da sessão',
    'Confirmação 24h antes',
    'Realização da sessão',
    'Seleção das fotos',
    'Entrega final'
  ]
};

export default function TaskChecklistForm({ 
  title, 
  setTitle, 
  checklistItems, 
  setChecklistItems 
}: TaskChecklistFormProps) {
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (newItem.trim()) {
      const item: ChecklistItem = {
        id: `item_${Date.now()}`,
        text: newItem.trim(),
        completed: false,
        createdAt: new Date().toISOString()
      };
      setChecklistItems([...checklistItems, item]);
      setNewItem('');
    }
  };

  const removeItem = (id: string) => {
    setChecklistItems(checklistItems.filter(item => item.id !== id));
  };

  const toggleItem = (id: string) => {
    setChecklistItems(checklistItems.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const updateItemText = (id: string, text: string) => {
    setChecklistItems(checklistItems.map(item => 
      item.id === id ? { ...item, text } : item
    ));
  };

  const loadTemplate = (templateKey: keyof typeof DEFAULT_CHECKLISTS) => {
    const items = DEFAULT_CHECKLISTS[templateKey].map((text, index) => ({
      id: `item_${Date.now()}_${index}`,
      text,
      completed: false,
      createdAt: new Date().toISOString()
    }));
    setChecklistItems(items);
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="title">Título do Checklist *</Label>
        <Input 
          id="title" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          required 
          placeholder="Ex.: Checklist edição ensaio Maria" 
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Templates Rápidos</Label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => loadTemplate('edicao-fotos')}
            className="flex items-center gap-1"
          >
            <Copy className="h-3 w-3" />
            Edição de Fotos
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => loadTemplate('atendimento-cliente')}
            className="flex items-center gap-1"
          >
            <Copy className="h-3 w-3" />
            Atendimento Cliente
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Itens do Checklist</Label>
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Digite um item do checklist"
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
          />
          <Button type="button" onClick={addItem} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {checklistItems.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
            {checklistItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 group">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                <Input
                  value={item.text}
                  onChange={e => updateItemText(item.id, e.target.value)}
                  className={`flex-1 ${item.completed ? 'line-through opacity-60' : ''}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}