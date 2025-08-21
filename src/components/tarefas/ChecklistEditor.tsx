import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChecklistItem } from '@/types/tasks';

interface ChecklistEditorProps {
  checklistItems: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  compact?: boolean;
}

export default function ChecklistEditor({ 
  checklistItems, 
  onChange, 
  compact = false 
}: ChecklistEditorProps) {
  const [newItemText, setNewItemText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const addItem = () => {
    if (!newItemText.trim()) return;
    
    const newItem: ChecklistItem = {
      id: `checklist_${Date.now()}`,
      text: newItemText.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };
    
    onChange([...checklistItems, newItem]);
    setNewItemText('');
  };

  const updateItem = (id: string, updates: Partial<ChecklistItem>) => {
    console.log('🔄 ChecklistEditor: Atualizando item', { id, updates });
    const updatedItems = checklistItems.map(item => 
      item.id === id ? { ...item, ...updates } : item
    );
    console.log('📋 ChecklistEditor: Items atualizados', updatedItems);
    onChange(updatedItems);
  };

  const removeItem = (id: string) => {
    onChange(checklistItems.filter(item => item.id !== id));
  };

  const startEditing = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const saveEdit = () => {
    console.log('💾 ChecklistEditor: Salvando edição', { editingId, editText });
    if (editingId && editText.trim() && editText.trim() !== '') {
      updateItem(editingId, { text: editText.trim() });
      console.log('✅ ChecklistEditor: Texto salvo:', editText.trim());
    }
    setEditingId(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: 'add' | 'edit') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (action === 'add') {
        addItem();
      } else {
        saveEdit();
      }
    } else if (e.key === 'Escape' && action === 'edit') {
      cancelEdit();
    }
  };

  return (
    <div className={cn("space-y-2", compact && "space-y-1")}>
      {/* Existing items */}
      {checklistItems.map((item) => (
        <div key={`${item.id}-${item.completed}-${item.text}`} className={cn(
          "flex items-center gap-2 group",
          compact ? "py-1" : "py-2"
        )}>
          <Checkbox
            checked={item.completed}
            onCheckedChange={(checked) => {
              console.log('☑️ ChecklistEditor: Checkbox clicado', { itemId: item.id, checked, currentState: item.completed });
              updateItem(item.id, { completed: !!checked });
            }}
            className="flex-shrink-0"
          />
          
          {editingId === item.id ? (
            <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, 'edit')}
                  onBlur={() => {
                    console.log('🔍 ChecklistEditor: Campo perdeu foco, salvando');
                    saveEdit();
                  }}
                  className={cn(
                    "text-sm bg-lunar-background border-lunar-border",
                    compact && "h-8"
                  )}
                  autoFocus
                />
            </div>
          ) : (
            <span
              className={cn(
                "flex-1 text-sm cursor-pointer hover:text-lunar-text transition-colors",
                item.completed 
                  ? "line-through text-lunar-textSecondary" 
                  : "text-lunar-text",
                compact && "text-xs"
              )}
              onClick={() => startEditing(item)}
            >
              {item.text}
            </span>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeItem(item.id)}
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0",
              compact && "h-6 w-6 p-0"
            )}
          >
            <X className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
          </Button>
        </div>
      ))}

      {/* Add new item */}
      <div className={cn("flex items-center gap-2", compact && "mt-2")}>
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => handleKeyPress(e, 'add')}
            placeholder="Adicionar item..."
            className={cn(
              "text-sm bg-lunar-background border-lunar-border",
              compact && "h-8 text-xs"
            )}
          />
          <Button
            onClick={addItem}
            disabled={!newItemText.trim()}
            size="sm"
            className={cn("flex-shrink-0", compact && "h-8 px-2")}
          >
            <Plus className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
          </Button>
        </div>
      </div>
    </div>
  );
}
