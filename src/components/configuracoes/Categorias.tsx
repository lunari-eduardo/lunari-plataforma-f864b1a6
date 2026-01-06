/**
 * Componente Categorias Refatorado
 * Padronizado conforme guia de UX - Edição inline
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Trash2, 
  AlertTriangle
} from 'lucide-react';
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

export default function Categorias({
  categorias,
  onAdd,
  onUpdate, 
  onDelete,
  pacotes
}: CategoriasProps) {
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novaCor, setNovaCor] = useState('#7950F2');
  const [addValidationError, setAddValidationError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const validateNewCategoria = useCallback((nome: string): string => {
    if (!nome.trim()) {
      return 'O nome da categoria é obrigatório';
    }
    if (nome.trim().length < 2) {
      return 'O nome deve ter pelo menos 2 caracteres';
    }
    const nomeExists = categorias.some(cat => 
      cat.nome.toLowerCase() === nome.trim().toLowerCase()
    );
    if (nomeExists) {
      return 'Já existe uma categoria com este nome';
    }
    return '';
  }, [categorias]);

  const podeRemoverCategoria = useCallback((id: string) => {
    return !pacotes.some(pacote => pacote.categoria_id === id);
  }, [pacotes]);

  const handleNomeCategoriaChange = useCallback((value: string) => {
    setNovaCategoria(value);
    const error = validateNewCategoria(value);
    setAddValidationError(error);
  }, [validateNewCategoria]);

  const adicionarCategoria = useCallback(async () => {
    const error = validateNewCategoria(novaCategoria);
    if (error) {
      setAddValidationError(error);
      return;
    }
    setIsLoading(true);
    try {
      onAdd({
        nome: novaCategoria.trim(),
        cor: novaCor
      });
      setNovaCategoria('');
      setNovaCor('#7950F2');
      setAddValidationError('');
    } finally {
      setIsLoading(false);
    }
  }, [novaCategoria, novaCor, onAdd, validateNewCategoria]);

  const removerCategoria = useCallback(async (id: string) => {
    if (!podeRemoverCategoria(id)) {
      return;
    }
    try {
      await onDelete(id);
    } catch (error) {
      console.error('Erro ao remover categoria:', error);
    }
  }, [onDelete, podeRemoverCategoria]);

  const canAddNew = novaCategoria.trim().length >= 2 && !addValidationError && !isLoading;

  return (
    <div className="space-y-6 py-4">
      <ConfigSectionHeader
        title="Categorias"
        subtitle="Configure as categorias para seus tipos de sessão fotográfica."
      />

      {/* Formulário Nova Categoria */}
      <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="nome" className="text-sm font-medium text-foreground">
              Nome da Categoria <span className="text-destructive">*</span>
            </label>
            <Input
              id="nome"
              placeholder="Ex: Gestante, Newborn, Família..."
              value={novaCategoria}
              onChange={(e) => handleNomeCategoriaChange(e.target.value)}
              className={cn(
                "h-10",
                addValidationError && "border-destructive focus-visible:ring-destructive"
              )}
              disabled={isLoading}
            />
            {addValidationError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {addValidationError}
              </p>
            )}
          </div>
          
          <div className="w-24 space-y-1.5">
            <label htmlFor="cor" className="text-sm font-medium text-foreground">
              Cor
            </label>
            <Input
              id="cor"
              type="color"
              value={novaCor}
              onChange={(e) => setNovaCor(e.target.value)}
              className="h-10 p-1 cursor-pointer"
            />
          </div>
          
          <div className="flex items-end">
            <Button
              onClick={adicionarCategoria}
              disabled={!canAddNew}
              className="h-10"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-current" />
                  Salvando...
                </div>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de Categorias */}
      <div className="space-y-3">
        {categorias.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">
              Nenhuma categoria encontrada. Crie sua primeira categoria acima.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {categorias.map((categoria, index) => {
              const podeRemover = podeRemoverCategoria(categoria.id);
              
              return (
                <InlineEditCategoriaRow
                  key={categoria.id}
                  categoria={categoria}
                  index={index}
                  categorias={categorias}
                  onUpdate={onUpdate}
                  onDelete={removerCategoria}
                  podeRemover={podeRemover}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function InlineEditCategoriaRow({ 
  categoria, 
  index,
  categorias,
  onUpdate,
  onDelete,
  podeRemover
}: {
  categoria: Categoria;
  index: number;
  categorias: Categoria[];
  onUpdate: (id: string, dados: Partial<Categoria>) => Promise<void>;
  onDelete: (id: string) => void;
  podeRemover: boolean;
}) {
  const [editNome, setEditNome] = useState(categoria.nome);
  const [editCor, setEditCor] = useState(categoria.cor);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditNome(categoria.nome);
      setEditCor(categoria.cor);
    }
  }, [categoria.nome, categoria.cor, isEditing]);

  const validateEdit = useCallback((nome: string): string => {
    if (!nome.trim()) {
      return 'O nome é obrigatório';
    }
    if (nome.trim().length < 2) {
      return 'Mínimo 2 caracteres';
    }
    // Check for duplicates excluding current category
    const nomeExists = categorias.some(cat => 
      cat.id !== categoria.id && 
      cat.nome.toLowerCase() === nome.trim().toLowerCase()
    );
    if (nomeExists) {
      return 'Nome já existe';
    }
    return '';
  }, [categorias, categoria.id]);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setError('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedNome = editNome.trim();
    const validationError = validateEdit(trimmedNome);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    // No changes? Just exit edit mode
    if (trimmedNome === categoria.nome && editCor === categoria.cor) {
      setIsEditing(false);
      setError('');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(categoria.id, { nome: trimmedNome, cor: editCor });
      setIsEditing(false);
      setError('');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setError('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  }, [editNome, editCor, categoria, onUpdate, validateEdit]);

  const handleCancel = useCallback(() => {
    setEditNome(categoria.nome);
    setEditCor(categoria.cor);
    setIsEditing(false);
    setError('');
  }, [categoria.nome, categoria.cor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Check if focus is moving to the color input or delete button
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('[data-inline-edit-row]')) {
      return;
    }
    handleSave();
  }, [handleSave]);

  return (
    <div 
      data-inline-edit-row
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors",
        index % 2 === 0 ? "bg-background" : "bg-muted/30",
        "hover:bg-accent/50"
      )}
    >
      <Input
        type="color"
        value={editCor}
        onChange={(e) => setEditCor(e.target.value)}
        onBlur={isEditing ? handleBlur : undefined}
        className="w-8 h-8 p-0.5 cursor-pointer flex-shrink-0 rounded"
        disabled={isSaving}
      />
      
      <div className="flex-1">
        {isEditing ? (
          <div className="space-y-1">
            <Input
              ref={inputRef}
              value={editNome}
              onChange={(e) => {
                setEditNome(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              className={cn(
                "h-8 text-sm",
                error && "border-destructive"
              )}
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
            className="font-medium text-sm cursor-pointer hover:text-primary"
            onClick={handleStartEdit}
          >
            {categoria.nome}
          </span>
        )}
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => onDelete(categoria.id)}
        disabled={isSaving || !podeRemover}
        className={cn(
          podeRemover 
            ? "text-destructive hover:text-destructive hover:bg-destructive/10" 
            : "opacity-50 cursor-not-allowed"
        )}
        title={!podeRemover ? 'Categoria vinculada a pacotes' : 'Remover categoria'}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}