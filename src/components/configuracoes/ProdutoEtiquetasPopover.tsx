import React, { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Plus, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProdutoEtiquetas } from '@/hooks/useProdutoEtiquetas';
import { EtiquetaChip } from '@/components/ui/etiqueta-chip';
import { ETIQUETA_COLOR_KEYS, getEtiquetaTokens, type EtiquetaColor } from '@/utils/etiquetaColorTokens';
import { normalizeString } from '@/utils/stringNormalization';
import type { ProdutoEtiqueta } from '@/types/configuration';

interface ProdutoEtiquetasPopoverProps {
  produtoId: string;
  etiquetas: ProdutoEtiqueta[];          // catálogo todo
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function ProdutoEtiquetasPopover({
  produtoId,
  etiquetas,
  selectedIds,
  onChange,
  trigger,
  align = 'end',
}: ProdutoEtiquetasPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<EtiquetaColor>('blue');
  const { criarEtiqueta } = useProdutoEtiquetas();

  const filtered = useMemo(() => {
    if (!query.trim()) return etiquetas;
    const q = normalizeString(query);
    return etiquetas.filter(e => normalizeString(e.nome).includes(q));
  }, [etiquetas, query]);

  const toggle = (id: string) => {
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange(Array.from(set));
  };

  const handleCreate = async () => {
    const nova = await criarEtiqueta(newName, newColor);
    if (nova) {
      onChange([...selectedIds, nova.id]);
      setNewName('');
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar etiquetas">
            <Tag className="h-3.5 w-3.5" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align={align}>
        <div className="p-2 border-b">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar etiqueta..."
            className="h-8 text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 && !creating && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Nenhuma etiqueta encontrada
            </div>
          )}
          {filtered.map(et => {
            const isSelected = selectedIds.includes(et.id);
            return (
              <button
                key={et.id}
                type="button"
                onClick={() => toggle(et.id)}
                className="w-full px-2 py-1.5 flex items-center justify-between hover:bg-accent text-xs"
              >
                <EtiquetaChip etiqueta={et} size="xs" />
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>

        <div className="border-t p-2">
          {creating ? (
            <div className="space-y-2">
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nome da etiqueta"
                className="h-8 text-xs"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <div className="grid grid-cols-10 gap-1">
                {ETIQUETA_COLOR_KEYS.map(c => {
                  const tk = getEtiquetaTokens(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cor ${c}`}
                      onClick={() => setNewColor(c)}
                      className={cn(
                        'h-5 w-5 rounded-full transition-all',
                        tk.swatch,
                        newColor === c && 'ring-2 ring-offset-1 ring-offset-background ring-foreground/60 scale-110'
                      )}
                    />
                  );
                })}
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreate} disabled={!newName.trim()}>
                  Criar
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCreating(false); setNewName(''); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs justify-start"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Criar nova etiqueta
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
