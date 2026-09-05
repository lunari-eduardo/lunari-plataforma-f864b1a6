import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from 'lucide-react';
import { Categoria } from '../../types';

interface StepCategoryProps {
  onBack: () => void;
  categorias: Categoria[];
  isLoadingCategorias: boolean;
  selectedCategoria: Categoria | null;
  setSelectedCategoria: (cat: Categoria | null) => void;
  customTitle: string;
  setCustomTitle: (title: string) => void;
  onSubmit: () => void;
}

export function StepCategory({
  onBack,
  categorias,
  isLoadingCategorias,
  selectedCategoria,
  setSelectedCategoria,
  customTitle,
  setCustomTitle,
  onSubmit,
}: StepCategoryProps) {
  return (
    <div className="py-4 space-y-6 animate-in slide-in-from-right-4 fade-in duration-200">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground transition-colors underline underline-offset-2"
        >
          ← Voltar
        </button>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Selecione a Categoria</label>
        {isLoadingCategorias ? (
          <Skeleton className="h-11 w-full rounded-md" />
        ) : categorias.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Tag className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Você ainda não cadastrou categorias.</p>
          </div>
        ) : (
          <Select
            value={selectedCategoria?.id || ''}
            onValueChange={(val) => setSelectedCategoria(categorias.find((c) => c.id === val) || null)}
          >
            <SelectTrigger className="h-11 w-full bg-card">
              <SelectValue placeholder="Escolha uma categoria..." />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.cor || '#6b7280' }} />
                    <span>{cat.nome}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedCategoria && (
        <div className="space-y-2 pt-2 border-t border-border animate-in slide-in-from-top-2 fade-in duration-200">
          <label className="text-sm font-medium text-foreground">
            Nome personalizado <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <Input
            placeholder={`Ex: Proposta ${selectedCategoria.nome} — Maria Fernanda`}
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="h-11"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && selectedCategoria) onSubmit();
            }}
          />
          <p className="text-xs text-muted-foreground">
            Se não informado, o título será <strong>"{selectedCategoria.nome}"</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
