import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProdutoEtiquetas } from '@/hooks/useProdutoEtiquetas';
import { ETIQUETA_COLOR_KEYS, getEtiquetaTokens, type EtiquetaColor } from '@/utils/etiquetaColorTokens';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EtiquetaChip } from '@/components/ui/etiqueta-chip';

interface EtiquetasManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EtiquetasManagerModal({ open, onOpenChange }: EtiquetasManagerModalProps) {
  const {
    etiquetas,
    contagemPorEtiqueta,
    criarEtiqueta,
    renomearEtiqueta,
    mudarCorEtiqueta,
    removerEtiqueta,
  } = useProdutoEtiquetas();

  const { confirm, dialogState, handleConfirm, handleCancel, handleClose } = useConfirmDialog();

  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState<EtiquetaColor>('blue');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState('');

  const handleCriar = async () => {
    const nova = await criarEtiqueta(novoNome, novaCor);
    if (nova) {
      setNovoNome('');
    }
  };

  const handleStartEdit = (id: string, nome: string) => {
    setEditingId(id);
    setEditingNome(nome);
  };

  const handleSaveEdit = async (id: string) => {
    if (editingNome.trim() && editingNome.trim() !== etiquetas.find(e => e.id === id)?.nome) {
      await renomearEtiqueta(id, editingNome.trim());
    }
    setEditingId(null);
    setEditingNome('');
  };

  const handleRemover = async (id: string, nome: string) => {
    const count = contagemPorEtiqueta.get(id) ?? 0;
    const ok = await confirm({
      title: `Remover etiqueta "${nome}"?`,
      description: count > 0
        ? `Esta etiqueta está em ${count} produto(s). Eles continuarão existindo, mas perderão esta etiqueta.`
        : 'Esta etiqueta não está atrelada a nenhum produto.',
      confirmText: 'Remover',
      cancelText: 'Cancelar',
    });
    if (ok) await removerEtiqueta(id);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar etiquetas</DialogTitle>
          </DialogHeader>

          {/* Criar nova */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <div className="text-xs font-medium text-muted-foreground">Nova etiqueta</div>
            <div className="flex gap-2">
              <Input
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder="Nome (ex: Álbum, Brinde)"
                className="h-9 text-sm"
                maxLength={32}
                onKeyDown={e => e.key === 'Enter' && handleCriar()}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Escolher cor">
                    <span className={cn('h-4 w-4 rounded-full', getEtiquetaTokens(novaCor).swatch)} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2">
                  <div className="grid grid-cols-5 gap-1.5">
                    {ETIQUETA_COLOR_KEYS.map(c => {
                      const tk = getEtiquetaTokens(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-label={c}
                          onClick={() => setNovaCor(c)}
                          className={cn(
                            'h-7 w-7 rounded-full transition-all',
                            tk.swatch,
                            novaCor === c && 'ring-2 ring-offset-2 ring-offset-background ring-foreground/60'
                          )}
                        />
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <Button onClick={handleCriar} disabled={!novoNome.trim()} className="h-9">
                <Plus className="h-4 w-4 mr-1" /> Criar
              </Button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-[50vh] overflow-y-auto space-y-1 pr-1">
            {etiquetas.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhuma etiqueta criada ainda.
              </div>
            ) : (
              etiquetas.map(et => {
                const count = contagemPorEtiqueta.get(et.id) ?? 0;
                const isEditing = editingId === et.id;
                return (
                  <div
                    key={et.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/40 group"
                  >
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Alterar cor"
                          className={cn('h-5 w-5 rounded-full shrink-0', getEtiquetaTokens(et.cor).swatch)}
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2">
                        <div className="grid grid-cols-5 gap-1.5">
                          {ETIQUETA_COLOR_KEYS.map(c => {
                            const tk = getEtiquetaTokens(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                aria-label={c}
                                onClick={() => mudarCorEtiqueta(et.id, c)}
                                className={cn(
                                  'h-7 w-7 rounded-full transition-all',
                                  tk.swatch,
                                  et.cor === c && 'ring-2 ring-offset-2 ring-offset-background ring-foreground/60'
                                )}
                              />
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {isEditing ? (
                      <Input
                        value={editingNome}
                        onChange={e => setEditingNome(e.target.value)}
                        onBlur={() => handleSaveEdit(et.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit(et.id);
                          if (e.key === 'Escape') { setEditingId(null); setEditingNome(''); }
                        }}
                        className="h-7 text-sm flex-1"
                        autoFocus
                        maxLength={32}
                      />
                    ) : (
                      <button
                        type="button"
                        className="flex-1 text-left text-sm font-medium truncate"
                        onClick={() => handleStartEdit(et.id, et.nome)}
                      >
                        {et.nome}
                      </button>
                    )}

                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {count} {count === 1 ? 'produto' : 'produtos'}
                    </span>

                    {isEditing ? (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveEdit(et.id)} aria-label="Salvar">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(null); setEditingNome(''); }} aria-label="Cancelar">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          onClick={() => handleStartEdit(et.id, et.nome)}
                          aria-label="Renomear"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                          onClick={() => handleRemover(et.id, et.nome)}
                          aria-label="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Preview de chips */}
          {etiquetas.length > 0 && (
            <div className="pt-3 border-t">
              <div className="text-xs font-medium text-muted-foreground mb-2">Visualização</div>
              <div className="flex flex-wrap gap-1.5">
                {etiquetas.map(et => (
                  <EtiquetaChip key={et.id} etiqueta={et} size="sm" />
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        state={dialogState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={handleClose}
      />
    </>
  );
}
