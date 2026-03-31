import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Save, X, RefreshCw, ChevronDown } from 'lucide-react';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { MACRO_GROUPS } from '@/constants/financialConstants';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';

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

function ItemRow({
  item,
  isEditing,
  nomeEditando,
  onClickName,
  onSaveEdit,
  onCancelEdit,
  onDeleteItem,
  onNomeEditandoChange,
}: {
  item: ItemFinanceiro;
  isEditing: boolean;
  nomeEditando: string;
  onClickName: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteItem: () => void;
  onNomeEditandoChange: (nome: string) => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSaveEdit();
    if (e.key === 'Escape') onCancelEdit();
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2">
        <Input
          value={nomeEditando}
          onChange={e => onNomeEditandoChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 h-8 text-sm"
          autoFocus
        />
        <Button size="sm" onClick={onSaveEdit} className="h-7 w-7 p-0" variant="ghost">
          <Save className="h-3.5 w-3.5 text-lunar-success" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-7 w-7 p-0">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 py-1.5 px-2 hover:bg-muted/30 transition-colors rounded-sm">
      <span
        onClick={onClickName}
        className="text-sm text-foreground flex-1 min-w-0 truncate cursor-pointer hover:text-primary transition-colors"
        title="Clique para editar"
      >
        {item?.nome || 'Item sem nome'}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={onDeleteItem}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SubSection({
  label,
  items,
  itemEditando,
  nomeEditando,
  onEditItem,
  onSaveEdit,
  onCancelEdit,
  onDeleteItem,
  onNomeEditandoChange,
  syncButton,
}: {
  label: string;
  items: ItemFinanceiro[];
  itemEditando: string | null;
  nomeEditando: string;
  onEditItem: (item: ItemFinanceiro) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDeleteItem: (id: string, nome: string) => void;
  onNomeEditandoChange: (nome: string) => void;
  syncButton?: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {syncButton}
      </div>
      <div className="divide-y divide-border/20">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-xs italic px-2 py-3">
            Nenhum item ainda. Adicione um usando o campo acima.
          </p>
        ) : (
          items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              isEditing={itemEditando === item.id}
              nomeEditando={nomeEditando}
              onClickName={() => onEditItem(item)}
              onSaveEdit={() => onSaveEdit(item.id)}
              onCancelEdit={onCancelEdit}
              onDeleteItem={() => onDeleteItem(item.id, item?.nome || 'Item sem nome')}
              onNomeEditandoChange={onNomeEditandoChange}
            />
          ))
        )}
      </div>
    </div>
  );
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
  const isMobile = useIsMobile();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MACRO_GROUPS.map(g => [g.label, true]))
  );

  const toggleSection = (label: string) => {
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const getSyncButton = (groupKey: GrupoPrincipal) => {
    if (groupKey !== 'Despesa Fixa' || custosDisponiveis <= 0) return undefined;
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {custosDisponiveis} na Precificação
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenSyncModal}
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Sincronizar
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {MACRO_GROUPS.map(macro => {
        const totalItems = macro.groups.reduce(
          (sum, g) => sum + (itensPorGrupo[g.key]?.length || 0), 0
        );

        const content = (
          <div className="space-y-4">
            {macro.groups.map(sub => (
              <SubSection
                key={sub.key}
                label={sub.label}
                items={itensPorGrupo[sub.key] || []}
                itemEditando={itemEditando}
                nomeEditando={nomeEditando}
                onEditItem={onEditItem}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                onDeleteItem={onDeleteItem}
                onNomeEditandoChange={onNomeEditandoChange}
                syncButton={getSyncButton(sub.key)}
              />
            ))}
          </div>
        );

        if (isMobile) {
          return (
            <Collapsible
              key={macro.label}
              open={openSections[macro.label]}
              onOpenChange={() => toggleSection(macro.label)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{macro.icon}</span>
                  <span className={`text-sm font-semibold ${macro.color}`}>
                    {macro.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({totalItems})
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    openSections[macro.label] ? 'rotate-180' : ''
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-1 pt-1">
                {content}
              </CollapsibleContent>
            </Collapsible>
          );
        }

        return (
          <div key={macro.label}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-sm">{macro.icon}</span>
              <span className={`text-sm font-semibold ${macro.color}`}>
                {macro.label}
              </span>
              <span className="text-xs text-muted-foreground">
                ({totalItems})
              </span>
            </div>
            <div className={`border-l-2 ${macro.borderColor} pl-3 ml-2`}>
              {content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
