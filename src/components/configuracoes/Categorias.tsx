/**
 * Componente Categorias Refatorado
 * Preparado para migração Supabase com melhor UX e performance
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  AlertTriangle,
  Palette,
  Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Categoria, Pacote } from '@/types/configuration';
interface CategoriasProps {
  categorias: Categoria[];
  onAdd: (categoria: Omit<Categoria, 'id'>) => void;
  onUpdate: (id: string, dados: Partial<Categoria>) => void;
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
  // Estados do formulário
  const [novaCategoria, setNovaCategoria] = useState('');
  const [editandoCategoria, setEditandoCategoria] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);


  // Validação em tempo real
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

  // Verificar se pode remover categoria
  const podeRemoverCategoria = useCallback((id: string) => {
    return !pacotes.some(pacote => pacote.categoria_id === id);
  }, [pacotes]);
  // Manipular mudanças no nome com validação
  const handleNomeCategoriaChange = useCallback((value: string) => {
    setNovaCategoria(value);
    const error = validateCategoria(value);
    setValidationError(error);
  }, [validateCategoria]);

  // Adicionar nova categoria
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
        cor: '#7950F2' // Cor padrão
      });
      setNovaCategoria('');
      setValidationError('');
    } finally {
      setIsLoading(false);
    }
  }, [novaCategoria, onAdd, validateCategoria]);
  // Iniciar edição
  const iniciarEdicaoCategoria = useCallback((id: string) => {
    setEditandoCategoria(id);
  }, []);

  // Salvar edição
  const salvarEdicaoCategoria = useCallback((id: string, nome: string, cor: string) => {
    const error = validateCategoria(nome);
    if (error) {
      setValidationError(error);
      return;
    }
    
    onUpdate(id, { nome: nome.trim(), cor });
    setEditandoCategoria(null);
    setValidationError('');
  }, [onUpdate, validateCategoria]);

  // Cancelar edição
  const cancelarEdicao = useCallback(() => {
    setEditandoCategoria(null);
    setValidationError('');
  }, []);

  // Remover categoria
  const removerCategoria = useCallback(async (id: string) => {
    if (!podeRemoverCategoria(id)) {
      const pacotesVinculados = pacotes.filter(p => p.categoria_id === id);
      const nomes = pacotesVinculados.map(p => p.nome).join(', ');
      // Toast será mostrado pelo hook useConfiguration
      return;
    }
    await onDelete(id);
  }, [onDelete, podeRemoverCategoria, pacotes]);

  // Determinar se pode adicionar
  const canAddNew = novaCategoria.trim().length >= 2 && !validationError && !isLoading;
  return (
    <div className="space-y-3 mt-2">
      {/* Formulário Nova Categoria */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Nova Categoria de Sessão
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Defina as categorias para seus tipos de sessão fotográfica.
          </p>
        </CardHeader>
        
        <CardContent className="p-3">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="nome" className="block text-sm font-medium mb-2">
                  Nome da Categoria <span className="text-destructive">*</span>
                </label>
                <Input
                  id="nome"
                  placeholder="Ex: Gestante, Newborn, Família..."
                  value={novaCategoria}
                  onChange={(e) => handleNomeCategoriaChange(e.target.value)}
                  className={cn(
                    "transition-colors",
                    validationError && "border-destructive focus-visible:ring-destructive"
                  )}
                  disabled={isLoading}
                />
                {validationError && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {validationError}
                  </p>
                )}
              </div>
              
              <div className="flex items-end">
                <Button
                  onClick={adicionarCategoria}
                  disabled={!canAddNew}
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
        </CardContent>
      </Card>
      {/* Lista de Categorias */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Categorias Cadastradas
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-3">
          {categorias.length === 0 ? (
            <div className="text-center py-8">
              <Palette className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-base font-medium mb-2">Nenhuma categoria encontrada</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Comece criando sua primeira categoria de sessão acima.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {categorias.map((categoria, index) => {
                const isEditing = editandoCategoria === categoria.id;
                const categoria_pode_remover = podeRemoverCategoria(categoria.id);
                
                return (
                  <div 
                    key={categoria.id} 
                    className={cn(
                      "flex items-center gap-3 p-2 border rounded-lg transition-colors",
                      "hover:bg-accent/50",
                      index % 2 === 0 ? "bg-background" : "bg-muted/30"
                    )}
                  >
                    {isEditing ? (
                      // Modo de edição com estado local
                      <EditingCategoriaRow
                        categoria={categoria}
                        onSave={salvarEdicaoCategoria}
                        onCancel={cancelarEdicao}
                        isLoading={isLoading}
                        validationError={validationError}
                      />
                    ) : (
                      // Modo de visualização
                      <>
                        <div className="flex-1">
                          <h4 className="font-medium">{categoria.nome}</h4>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => iniciarEdicaoCategoria(categoria.id)}
                            disabled={isLoading}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removerCategoria(categoria.id)}
                            disabled={isLoading || !categoria_pode_remover}
                            className={cn(
                              categoria_pode_remover 
                                ? "text-destructive hover:text-destructive-foreground hover:bg-destructive" 
                                : "opacity-50 cursor-not-allowed"
                            )}
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
        </CardContent>
      </Card>
    </div>
  );
}

// Componente separado para linha de edição
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
      <div className="flex-1">
        <Input
          value={editData.nome}
          onChange={(e) => setEditData(prev => ({ ...prev, nome: e.target.value }))}
          className={cn(
            "transition-colors",
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
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-current" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}