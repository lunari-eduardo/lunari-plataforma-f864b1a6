/**
 * SEÇÃO DE ITENS FINANCEIROS
 * 
 * Componente responsável por gerenciar a exibição e interação com itens financeiros
 * Inclui formulário de adição e lista agrupada por categoria
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, Save, X, RefreshCw, Loader2 } from 'lucide-react';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { useFinancialItems } from '@/hooks/useFinancialItems';
import { usePricingSync } from '@/hooks/usePricingSync';
import { GRUPOS_PRINCIPAIS, CORES_GRUPO, PLACEHOLDERS } from '@/constants/financialConstants';

interface FinancialItemsSectionProps {
  itensFinanceiros: ItemFinanceiro[];
  adicionarItemFinanceiro: (nome: string, grupo: GrupoPrincipal) => Promise<any>;
  removerItemFinanceiro: (id: string) => Promise<void>;
  atualizarItemFinanceiro: (id: string, dadosAtualizados: Partial<ItemFinanceiro>) => Promise<any>;
  onSyncModalOpen: () => void;
}

export default function FinancialItemsSection({
  itensFinanceiros,
  adicionarItemFinanceiro,
  removerItemFinanceiro,
  atualizarItemFinanceiro,
  onSyncModalOpen
}: FinancialItemsSectionProps) {

  // ============= HOOKS =============
  
  const {
    novoItem,
    itemEditando,
    loading,
    itensPorGrupo,
    handleAdicionarItem,
    handleEditarItem,
    handleSalvarEdicao,
    handleCancelarEdicao,
    handleRemoverItem,
    updateNovoItem,
    updateItemEditando,
    podeAdicionarItem,
    podeSalvarEdicao
  } = useFinancialItems({
    itensFinanceiros,
    adicionarItemFinanceiro,
    removerItemFinanceiro,
    atualizarItemFinanceiro
  });

  const { custosDisponiveis } = usePricingSync();

  // ============= HANDLERS =============
  
  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  // ============= RENDER =============
  
  return (
    <div className="space-y-6">
      {/* Formulário para Adicionar Novo Item */}
      <Card className="bg-card rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-5 w-5" />
            Adicionar Novo Item Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome-item">Nome do Item</Label>
              <Input 
                id="nome-item" 
                placeholder={PLACEHOLDERS.NOME_ITEM}
                value={novoItem.nome}
                onChange={(e) => updateNovoItem({ nome: e.target.value })}
                onKeyPress={(e) => handleKeyPress(e, handleAdicionarItem)}
                disabled={loading.adicionando}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="grupo-item">Grupo Principal</Label>
              <Select 
                value={novoItem.grupo} 
                onValueChange={(value) => updateNovoItem({ grupo: value as GrupoPrincipal })}
                disabled={loading.adicionando}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRUPOS_PRINCIPAIS.map(grupo => (
                    <SelectItem key={grupo} value={grupo}>
                      {grupo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={handleAdicionarItem}
                disabled={!podeAdicionarItem}
                className="w-full"
              >
                {loading.adicionando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Itens por Grupo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {GRUPOS_PRINCIPAIS.map(grupo => (
          <Card key={grupo} className="h-fit rounded-lg bg-card">
            <CardHeader className="pb-2 bg-card rounded-lg">
              <CardTitle className="text-sm">
                <div className="flex items-center justify-between">
                  <Badge className={`${CORES_GRUPO[grupo]} text-xs font-medium`}>
                    {grupo}
                  </Badge>
                  
                  {/* Sync para Despesa Fixa */}
                  {grupo === 'Despesa Fixa' && custosDisponiveis > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {custosDisponiveis} na Precificação
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onSyncModalOpen}
                        className="h-6 px-2 text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Sincronizar
                      </Button>
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="pt-0 bg-card rounded-lg">
              {itensPorGrupo[grupo].length === 0 ? (
                <p className="text-lunar-textSecondary text-xs italic text-center py-2">
                  Nenhum item cadastrado neste grupo.
                </p>
              ) : (
                <div className="space-y-1">
                  {itensPorGrupo[grupo].map(item => (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-2 bg-lunar-surface/50 border border-lunar-border/30 rounded-lg hover:bg-lunar-surface/80 transition-colors"
                    >
                      {itemEditando?.id === item.id ? (
                        /* Modo de Edição */
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={itemEditando.nome}
                            onChange={(e) => updateItemEditando(e.target.value)}
                            className="flex-1 text-sm"
                            onKeyPress={(e) => handleKeyPress(e, handleSalvarEdicao)}
                            disabled={loading.editando}
                            autoFocus
                          />
                          <Button 
                            size="sm" 
                            onClick={handleSalvarEdicao}
                            disabled={!podeSalvarEdicao}
                            className="h-8 w-8 p-0"
                          >
                            {loading.editando ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={handleCancelarEdicao}
                            disabled={loading.editando}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        /* Modo de Visualização */
                        <>
                          <span className="text-lunar-text text-xs font-medium flex-1 min-w-0 truncate pr-2">
                            {item.nome}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleEditarItem(item)}
                              className="h-8 w-8 p-0 hover:bg-lunar-accent/20"
                              disabled={loading.removendo === item.id}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleRemoverItem(item.id)}
                              disabled={loading.removendo === item.id}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              {loading.removendo === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}