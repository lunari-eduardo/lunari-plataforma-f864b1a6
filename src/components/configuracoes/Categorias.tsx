/**
 * Componente Categorias Refatorado
 * Padronizado conforme guia de UX
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
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
  const [editandoCategoria, setEditandoCategoria] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const validateCategoria = useCallback((nome: string): string => {
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
    const error = validateCategoria(value);
    setValidationError(error);
  }, [validateCategoria]);

  const adicionarCategoria = useCallback(async () => {
    const error = validateCategoria(novaCategoria);
    if (error) {
      setValidationError(error);
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
      setValidationError('');
    } finally {
      setIsLoading(false);
    }
  }, [novaCategoria, novaCor, onAdd, validateCategoria]);

  const iniciarEdicaoCategoria = useCallback((id: string) => {
    setEditandoCategoria(id);
  }, []);

  const salvarEdicaoCategoria = useCallback(async (id: string, nome: string, cor: string) => {
    const error = validateCategoria(nome);
    if (error) {
      setValidationError(error);
      return;
    }
    try {
      await onUpdate(id, { nome: nome.trim(), cor });
      setEditandoCategoria(null);
      setValidationError('');
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
    }
  }, [onUpdate, validateCategoria]);

  const cancelarEdicao = useCallback(() => {
    setEditandoCategoria(null);
    setValidationError('');
  }, []);

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

  const canAddNew = novaCategoria.trim().length >= 2 && !validationError && !isLoading;

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
                validationError && "border-destructive focus-visible:ring-destructive"
              )}
              disabled={isLoading}
            />
            {validationError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {validationError}
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
              const isEditing = editandoCategoria === categoria.id;
              const podeRemover = podeRemoverCategoria(categoria.id);
              
              return (
                <div 
                  key={categoria.id} 
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors",
                    index % 2 === 0 ? "bg-background" : "bg-muted/30",
                    "hover:bg-accent/50"
                  )}
                >
                  {isEditing ? (
                    <EditingCategoriaRow
                      categoria={categoria}
                      onSave={salvarEdicaoCategoria}
                      onCancel={cancelarEdicao}
                      isLoading={isLoading}
                      validationError={validationError}
                    />
                  ) : (
                    <>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: categoria.cor }}
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm">{categoria.nome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => iniciarEdicaoCategoria(categoria.id)}
                          disabled={isLoading}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removerCategoria(categoria.id)}
                          disabled={isLoading || !podeRemover}
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
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EditingCategoriaRow({ 
  categoria, 
  onSave, 
  onCancel, 
  isLoading, 
  validationError 
}: {
  categoria: Categoria;
  onSave: (id: string, nome: string, cor: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  validationError: string;
}) {
  const [editData, setEditData] = useState({
    nome: categoria.nome,
    cor: categoria.cor
  });

  const handleSave = useCallback(() => {
    onSave(categoria.id, editData.nome, editData.cor);
  }, [categoria.id, editData, onSave]);

  const canSave = editData.nome.trim().length >= 2 && !validationError && !isLoading;

  return (
    <>
      <Input
        type="color"
        value={editData.cor}
        onChange={(e) => setEditData(prev => ({ ...prev, cor: e.target.value }))}
        className="w-10 h-8 p-1 cursor-pointer flex-shrink-0"
        disabled={isLoading}
      />
      <div className="flex-1">
        <Input
          value={editData.nome}
          onChange={(e) => setEditData(prev => ({ ...prev, nome: e.target.value }))}
          className={cn(
            "h-8",
            validationError && "border-destructive"
          )}
          placeholder="Nome da categoria"
          disabled={isLoading}
        />
        {validationError && (
          <p className="text-xs text-destructive mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {validationError}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!canSave}
        >
          <Save className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
