import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2, Save, X, RefreshCw } from 'lucide-react';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { FINANCIAL_GROUPS, GROUP_COLORS } from '@/constants/financialConstants';

interface ItemsListProps {
  itensPorGrupo: Record<GrupoPrincipal, ItemFinanceiro[]>;
  itemEditando: string | null;
  nomeEditando: string;
  custosDisponiveis: number;
  onEditItem: (item: ItemFinanceiro) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDeleteItem: (id: string, nome: string) => void;
  onOpenSyncModal: () => void;
  onNomeEditandoChange: (nome: string) => void;
}

export function ItemsList({
  itensPorGrupo,
  itemEditando,
  nomeEditando,
  custosDisponiveis,
  onEditItem,
  onSaveEdit,
  onCancelEdit,
  onDeleteItem,
  onOpenSyncModal,
  onNomeEditandoChange
}: ItemsListProps) {
  const handleKeyPress = (e: React.KeyboardEvent, itemId: string) => {
    if (e.key === 'Enter') {
      onSaveEdit(itemId);
    }
  };

  const getCorGrupo = (grupo: GrupoPrincipal) => {
    return GROUP_COLORS[grupo] || 'bg-muted text-foreground border-border';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {FINANCIAL_GROUPS.map(grupo => (
        <Card key={grupo} className="h-fit rounded-lg bg-card">
          <CardHeader className="pb-2 bg-card rounded-lg">
            <CardTitle className="text-sm">
              <div className="flex items-center justify-between">
                <Badge className={`${getCorGrupo(grupo)} text-xs font-medium`}>
                  {grupo}
                </Badge>
                {grupo === 'Despesa Fixa' && (
                  <div className="flex items-center gap-2">
                    {custosDisponiveis > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {custosDisponiveis} na Precificação
                      </Badge>
                    )}
                    {custosDisponiveis > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onOpenSyncModal}
                        className="h-6 px-2 text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Sincronizar
                      </Button>
                    )}
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
                    className="flex items-center justify-between p-2 bg-lunar-surface/50 border border-lunar-border/30 rounded-lg hover:bg-lunar-surface/80 transition-colors py-0"
                  >
                    {itemEditando === item.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input 
                          value={nomeEditando} 
                          onChange={e => onNomeEditandoChange(e.target.value)} 
                          className="flex-1 text-sm" 
                          onKeyPress={e => handleKeyPress(e, item.id)}
                        />
                        <Button 
                          size="sm" 
                          onClick={() => onSaveEdit(item.id)} 
                          className="h-8 w-8 p-0"
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={onCancelEdit} 
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-lunar-text text-xs font-medium flex-1 min-w-0 truncate pr-2">
                          {item?.nome || 'Item sem nome'}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => onEditItem(item)} 
                            className="h-8 w-8 p-0 hover:bg-lunar-accent/20"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => onDeleteItem(item.id, item?.nome || 'Item sem nome')} 
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
  );
}