/**
 * Componente Categorias — Compacto, sem cor manual, edição inline funcional
 */

import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfigSectionHeader from './ConfigSectionHeader';
import type { Categoria, Pacote } from '@/types/configuration';

interface CategoriasProps {
  categorias: Categoria[];
  onAdd: (categoria: Omit<Categoria, 'id'>) => void;
  onUpdate: (id: string, dados: Partial<Categoria>) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
  pacotes: Pacote[];
}

// ── Inline Row (stable component, outside parent) ──────────────────────────

interface InlineRowProps {
  categoria: Categoria;
  onUpdate: (id: string, dados: Partial<Categoria>) => Promise<void>;
  onDelete: (id: string) => void;
  podeRemover: boolean;
  allCategorias: Categoria[];
}

function InlineEditCategoriaRow({ categoria, onUpdate, onDelete, podeRemover, allCategorias }: InlineRowProps) {
  const [editNome, setEditNome] = useState(categoria.nome);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const deleteClickedRef = useRef(false);

  // Resync com a prop quando o nome muda externamente (realtime de outra aba/device)
  // — somente quando NÃO está em edição, para não interromper digitação local.
  React.useEffect(() => {
    if (!isEditing) setEditNome(categoria.nome);
  }, [categoria.nome, isEditing]);

  const validate = useCallback((nome: string): string => {
    if (!nome.trim()) return 'Nome obrigatório';
    if (nome.trim().length < 2) return 'Mínimo 2 caracteres';
    const dup = allCategorias.some(c => c.id !== categoria.id && c.nome.toLowerCase() === nome.trim().toLowerCase());
    if (dup) return 'Nome já existe';
    return '';
  }, [allCategorias, categoria.id]);

  const startEdit = useCallback(() => {
    setEditNome(categoria.nome);
    setIsEditing(true);
    setError('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [categoria.nome]);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    const trimmed = editNome.trim();
    const validationError = validate(trimmed);
    if (validationError) { setError(validationError); return; }
    if (trimmed === categoria.nome) { setIsEditing(false); setError(''); return; }

    // Otimista: fecha imediatamente — UI já reflete via update otimista do contexto
    savingRef.current = true;
    setIsEditing(false);
    setError('');
    try {
      await onUpdate(categoria.id, { nome: trimmed });
    } catch {
      // Reverte: reabre input com erro
      setIsEditing(true);
      setError('Erro ao salvar');
      setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      savingRef.current = false;
    }
  }, [editNome, categoria, onUpdate, validate]);

  const cancel = useCallback(() => {
    setEditNome(categoria.nome);
    setIsEditing(false);
    setError('');
  }, [categoria.nome]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') cancel();
  }, [save, cancel]);

  const handleBlur = useCallback(() => {
    // Skip save if user clicked the delete button
    if (deleteClickedRef.current) { deleteClickedRef.current = false; return; }
    save();
  }, [save]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors group">
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-0.5">
            <Input
              ref={inputRef}
              value={editNome}
              onChange={(e) => { setEditNome(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              className={cn("h-7 text-sm py-0", error && "border-destructive")}
              placeholder="Nome da categoria"
              disabled={isSaving}
            />
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        ) : (
          <span
            className="text-sm font-medium cursor-pointer hover:text-primary truncate block"
            onClick={startEdit}
          >
            {categoria.nome}
          </span>
        )}
      </div>

      <Button
        size="sm"
        variant="ghost"
        onMouseDown={() => { deleteClickedRef.current = true; }}
        onClick={() => onDelete(categoria.id)}
        disabled={isSaving || !podeRemover}
        className={cn(
          "h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity",
          podeRemover
            ? "text-destructive hover:text-destructive hover:bg-destructive/10"
            : "opacity-50 cursor-not-allowed"
        )}
        title={!podeRemover ? 'Categoria vinculada a pacotes' : 'Remover categoria'}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function Categorias({ categorias, onAdd, onUpdate, onDelete, pacotes }: CategoriasProps) {
  const [novaCategoria, setNovaCategoria] = useState('');
  const [addError, setAddError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateNew = useCallback((nome: string): string => {
    if (!nome.trim()) return 'Nome obrigatório';
    if (nome.trim().length < 2) return 'Mínimo 2 caracteres';
    if (categorias.some(c => c.nome.toLowerCase() === nome.trim().toLowerCase())) return 'Nome já existe';
    return '';
  }, [categorias]);

  const handleChange = useCallback((value: string) => {
    setNovaCategoria(value);
    setAddError(validateNew(value));
  }, [validateNew]);

  const adicionar = useCallback(async () => {
    const err = validateNew(novaCategoria);
    if (err) { setAddError(err); return; }
    setIsLoading(true);
    try {
      onAdd({ nome: novaCategoria.trim() } as Omit<Categoria, 'id'>);
      setNovaCategoria('');
      setAddError('');
    } finally {
      setIsLoading(false);
    }
  }, [novaCategoria, onAdd, validateNew]);

  const podeRemover = useCallback((id: string) => !pacotes.some(p => p.categoria_id === id), [pacotes]);

  const canAdd = novaCategoria.trim().length >= 2 && !addError && !isLoading;

  return (
    <div className="space-y-4 py-4">
      <ConfigSectionHeader
        title="Categorias"
        subtitle="Configure as categorias para seus tipos de sessão fotográfica."
      />

      {/* Add form — single compact row */}
      <div className="flex gap-2 items-start">
        <div className="flex-1 space-y-1">
          <Input
            placeholder="Nova categoria..."
            value={novaCategoria}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canAdd) adicionar(); }}
            className={cn("h-9", addError && novaCategoria && "border-destructive focus-visible:ring-destructive")}
            disabled={isLoading}
          />
          {addError && novaCategoria && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {addError}
            </p>
          )}
        </div>
        <Button onClick={adicionar} disabled={!canAdd} size="sm" className="h-9">
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {/* List */}
      {categorias.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground">
            Nenhuma categoria cadastrada.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {categorias.map((cat) => (
            <InlineEditCategoriaRow
              key={cat.id}
              categoria={cat}
              allCategorias={categorias}
              onUpdate={onUpdate}
              onDelete={async (id) => { await onDelete(id); }}
              podeRemover={podeRemover(cat.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
