import { Smartphone, Tablet, Monitor, Eye, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { CoverCatalog } from '@/components/deliver/CoverCatalog';
import { ThemePreviewCanvas } from '@/components/dashboard/themes/ThemePreviewCanvas';
import { THEME_REGISTRY } from '@/components/gallery/themes/registry';
import { GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { cn } from '@/lib/utils';

interface DeliverDesignTabProps {
  useCustomTheme: boolean;
  setUseCustomTheme: (custom: boolean) => void;
  activeThemeId: string;
  setActiveThemeId: (id: string) => void;
  themeOverrides: any;
  setThemeOverrides: (overrides: any) => void;
  coverId: string | null;
  setCoverId: (id: string | null) => void;
  previewViewport: 'mobile' | 'tablet' | 'desktop';
  setPreviewViewport: (vp: 'mobile' | 'tablet' | 'desktop') => void;
  photos: GaleriaPhoto[];
  publicToken?: string | null;
  saving: boolean;
  onSave: () => void;
}

export function DeliverDesignTab({
  useCustomTheme,
  setUseCustomTheme,
  activeThemeId,
  setActiveThemeId,
  themeOverrides,
  setThemeOverrides,
  coverId,
  setCoverId,
  previewViewport,
  setPreviewViewport,
  photos,
  publicToken,
  saving,
  onSave,
}: DeliverDesignTabProps) {
  return (
    <div className="space-y-8 mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Herança de Tema</h3>
            <p className="text-sm text-muted-foreground">
              Decida se esta galeria segue as regras da sua conta ou tem estilo próprio.
            </p>

            <div className="space-y-3">
              <div
                className={cn(
                  'p-4 border rounded-xl cursor-pointer transition-all',
                  !useCustomTheme
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted'
                )}
                onClick={() => setUseCustomTheme(false)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      !useCustomTheme ? 'border-primary' : 'border-muted-foreground'
                    )}
                  >
                    {!useCustomTheme && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">Herdar tema padrão</p>
                    <p className="text-xs text-muted-foreground">
                      Usa o tema definido nas configurações da sua conta.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'p-4 border rounded-xl cursor-pointer transition-all',
                  useCustomTheme
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted'
                )}
                onClick={() => setUseCustomTheme(true)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      useCustomTheme ? 'border-primary' : 'border-muted-foreground'
                    )}
                  >
                    {useCustomTheme && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">Personalizar esta galeria</p>
                    <p className="text-xs text-muted-foreground">
                      Escolha um tema e ajustes específicos apenas para este trabalho.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {useCustomTheme && (
            <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-4">
                <Label className="text-base font-semibold">Selecione o Preset</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.values(THEME_REGISTRY).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setActiveThemeId(t.id)}
                      className={cn(
                        'flex flex-col gap-2 p-3 border rounded-xl cursor-pointer transition-all text-center',
                        activeThemeId === t.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:border-primary/50'
                      )}
                    >
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {t.layout.engine === 'editorial-grid' ? 'Editorial' : 'Classic'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <Label className="text-base font-semibold">Ajustes Visuais</Label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Espaçamento (Gap)</Label>
                    <span className="text-xs font-mono">{themeOverrides?.layout?.gap ?? 8}px</span>
                  </div>
                  <Slider
                    value={[themeOverrides?.layout?.gap ?? 8]}
                    onValueChange={(vals) =>
                      setThemeOverrides({
                        ...themeOverrides,
                        layout: { ...(themeOverrides.layout || {}), gap: vals[0] },
                      })
                    }
                    min={0}
                    max={40}
                    step={1}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Capa da Galeria de Entrega — independente do Tema */}
          <div className="space-y-4 pt-2 border-t">
            <div>
              <Label className="text-base font-semibold">Capa da Galeria</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Apresentação inicial (Hero). Independe do Tema (grid).
              </p>
            </div>
            <CoverCatalog selectedCoverId={coverId} onSelect={setCoverId} />
          </div>

          <div className="pt-4 border-t">
            <Button onClick={onSave} className="w-full gap-2 rounded-xl" disabled={saving}>
              <Save className="h-4 w-4" />
              Salvar Design
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">
              Preview:{' '}
              {useCustomTheme
                ? `${THEME_REGISTRY[activeThemeId]?.name} (personalizado)`
                : 'Herança da conta'}
            </h4>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
              <Button
                variant={previewViewport === 'mobile' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setPreviewViewport('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
              <Button
                variant={previewViewport === 'tablet' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setPreviewViewport('tablet')}
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button
                variant={previewViewport === 'desktop' ? 'secondary' : 'ghost'}
                size="icon"
                className={cn('h-8 w-8', previewViewport === 'desktop' && 'bg-background shadow-sm')}
                onClick={() => setPreviewViewport('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-[600px] h-[70vh] bg-muted rounded-2xl border border-muted overflow-hidden relative group shadow-lg">
            <div className="absolute inset-0 bg-background overflow-hidden flex flex-col">
              <ThemePreviewCanvas
                themeId={activeThemeId}
                themeOverrides={themeOverrides}
                viewport={previewViewport}
                skipHero={true}
                isBlueprint={false}
                previewPhotos={photos.slice(0, 12)}
              />
            </div>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
              <Button
                variant="secondary"
                className="gap-2 rounded-full"
                onClick={() => window.open(`/g/${publicToken}`, '_blank')}
              >
                <Eye className="h-4 w-4" />
                Ver prévia completa
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
