import { Save, Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DiscountPackage } from '@/types/gallery';
import { useDiscountPresets } from '../hooks/useDiscountPresets';

export interface Step2DiscountPackagesProps {
  discountPackages: DiscountPackage[];
  setDiscountPackages: (packages: DiscountPackage[]) => void;
  addDiscountPackage: () => void;
  updateDiscountPackage: (id: string, field: keyof DiscountPackage, value: number | null) => void;
  removeDiscountPackage: (id: string) => void;
  settings: any;
  createDiscountPreset: any;
  updateDiscountPreset: any;
  deleteDiscountPreset: any;
}

export function Step2DiscountPackages({
  discountPackages,
  setDiscountPackages,
  addDiscountPackage,
  updateDiscountPackage,
  removeDiscountPackage,
  settings,
  createDiscountPreset,
  updateDiscountPreset,
  deleteDiscountPreset,
}: Step2DiscountPackagesProps) {
  const {
    showSavePresetDialog,
    setShowSavePresetDialog,
    presetName,
    setPresetName,
    renamingPreset,
    setRenamingPreset,
    renameValue,
    setRenameValue,
    deletingPresetId,
    setDeletingPresetId,
    savePreset,
    loadPreset,
    renamePreset,
    confirmDeletePreset,
  } = useDiscountPresets({
    settings,
    discountPackages,
    setDiscountPackages,
    createDiscountPreset,
    updateDiscountPreset,
    deleteDiscountPreset,
  });

  return (
    <>
      <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label className="text-sm font-medium">Configurar faixas</Label>
          <div className="flex gap-2 flex-wrap">
            {discountPackages.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSavePresetDialog(true)}
                className="gap-1"
              >
                <Save className="h-4 w-4" />
                Salvar
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDiscountPackage}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>

        {discountPackages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Adicione faixas para definir preços por quantidade
          </p>
        ) : (
          <div className="space-y-3">
            {discountPackages.map((pkg, index) => (
              <div
                key={pkg.id}
                className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border/50"
              >
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">De</Label>
                    <Input
                      type="number"
                      min={1}
                      value={pkg.minPhotos}
                      onChange={(e) =>
                        updateDiscountPackage(
                          pkg.id,
                          'minPhotos',
                          parseInt(e.target.value) || 1
                        )
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Até</Label>
                    {index === discountPackages.length - 1 ? (
                      <Input
                        type="text"
                        value={pkg.maxPhotos === null ? '∞' : pkg.maxPhotos}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || val === '∞') {
                            updateDiscountPackage(pkg.id, 'maxPhotos', null);
                          } else {
                            const num = parseInt(val);
                            if (!isNaN(num)) {
                              updateDiscountPackage(pkg.id, 'maxPhotos', num);
                            }
                          }
                        }}
                        placeholder="∞"
                        className="h-8 text-center"
                      />
                    ) : (
                      <Input
                        type="number"
                        min={pkg.minPhotos}
                        value={pkg.maxPhotos ?? ''}
                        onChange={(e) =>
                          updateDiscountPackage(
                            pkg.id,
                            'maxPhotos',
                            parseInt(e.target.value) || pkg.minPhotos
                          )
                        }
                        className="h-8"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">R$</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={pkg.pricePerPhoto}
                      onChange={(e) =>
                        updateDiscountPackage(
                          pkg.id,
                          'pricePerPhoto',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-8"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDiscountPackage(pkg.id)}
                  className="text-destructive hover:text-destructive h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Predefinições salvas */}
        {settings.discountPresets && settings.discountPresets.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Predefinições salvas
            </Label>
            <div className="space-y-1.5">
              {settings.discountPresets.map((preset: any) => {
                const prices = preset.packages
                  .map((p: any) => p.pricePerPhoto)
                  .filter((v: any) => typeof v === 'number');
                const minP = prices.length ? Math.min(...prices) : 0;
                const maxP = prices.length ? Math.max(...prices) : 0;
                const priceLabel = prices.length
                  ? minP === maxP
                    ? `R$ ${minP.toFixed(2)}`
                    : `R$ ${minP.toFixed(2)}–${maxP.toFixed(2)}`
                  : '—';
                return (
                  <div
                    key={preset.id}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{preset.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {preset.packages.length} faixa
                        {preset.packages.length !== 1 ? 's' : ''} · {priceLabel}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loadPreset(preset.id)}
                      className="h-7 text-xs"
                    >
                      Carregar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setRenamingPreset(preset);
                        setRenameValue(preset.name);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeletingPresetId(preset.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dialog para salvar predefinição */}
      <Dialog open={showSavePresetDialog} onOpenChange={setShowSavePresetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar predefinição de faixas</DialogTitle>
            <DialogDescription>
              Salve esta configuração de faixas para reutilizar em outras galerias
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="presetName">Nome da predefinição</Label>
              <Input
                id="presetName"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Ex: Casamentos, Ensaios..."
              />
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-2">Faixas a salvar:</p>
              {discountPackages.map((pkg) => (
                <p key={pkg.id} className="text-sm">
                  {pkg.minPhotos} - {pkg.maxPhotos === null ? '∞' : pkg.maxPhotos} fotos: R${' '}
                  {pkg.pricePerPhoto.toFixed(2)}
                </p>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSavePresetDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={savePreset}>Salvar predefinição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog renomear predefinição */}
      <Dialog
        open={!!renamingPreset}
        onOpenChange={(open) => {
          if (!open) {
            setRenamingPreset(null);
            setRenameValue('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear predefinição</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="renamePreset">Novo nome</Label>
            <Input
              id="renamePreset"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenamingPreset(null);
                setRenameValue('');
              }}
            >
              Cancelar
            </Button>
            <Button onClick={renamePreset}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão de predefinição */}
      <AlertDialog
        open={!!deletingPresetId}
        onOpenChange={(open) => {
          if (!open) setDeletingPresetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir predefinição?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Galerias já criadas não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePreset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
