import { Sparkles, Palette, Sun, Moon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { FontSelect } from '@/components/FontSelect';
import { ThemeCatalog } from '@/components/dashboard/themes/ThemeCatalog';
import { CoverCatalog } from '@/components/deliver/CoverCatalog';
import { COVER_REGISTRY } from '@/components/deliver/covers/registry';
import { TitleCaseMode } from '@/types/gallery';
import { cn } from '@/lib/utils';

interface DeliverCreateStep2VisualProps {
  sessionFont: string;
  setSessionFont: (font: string) => void;
  sessionName: string;
  titleCaseMode: TitleCaseMode;
  setTitleCaseMode: (mode: TitleCaseMode) => void;
  useCustomTheme: boolean;
  setUseCustomTheme: (custom: boolean) => void;
  activeThemeId: string;
  setActiveThemeId: (id: string) => void;
  themeOverrides: any;
  setThemeOverrides: (overrides: any) => void;
  coverId: string | null;
  setCoverId: (id: string | null) => void;
  settings: any;
  photoSpacing: number;
  setPhotoSpacing: (gap: number) => void;
  clientMode: 'light' | 'dark';
  setClientMode: (mode: 'light' | 'dark') => void;
}

export function DeliverCreateStep2Visual({
  sessionFont,
  setSessionFont,
  sessionName,
  titleCaseMode,
  setTitleCaseMode,
  useCustomTheme,
  setUseCustomTheme,
  activeThemeId,
  setActiveThemeId,
  themeOverrides,
  setThemeOverrides,
  coverId,
  setCoverId,
  settings,
  photoSpacing,
  setPhotoSpacing,
  clientMode,
  setClientMode,
}: DeliverCreateStep2VisualProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border/40 pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#cbb384]" />
          <h2 className="text-lg font-semibold text-foreground">Design e Personalização Visual</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Escolha a tipografia, estilo de apresentação e layout editorial para encantar o cliente.
        </p>
      </div>

      {/* Font Select */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">Tipografia do Título</Label>
        <FontSelect
          value={sessionFont}
          onChange={setSessionFont}
          previewText={sessionName || 'Ensaio Editorial'}
          titleCaseMode={titleCaseMode}
          onTitleCaseModeChange={setTitleCaseMode}
        />
      </div>

      {/* Tema da Galeria */}
      <div className="space-y-4 pt-4 border-t border-border/40">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-[#cbb384]" />
          <Label className="text-base font-semibold">Tema da Galeria</Label>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div
            className={cn(
              'p-3.5 border rounded-xl cursor-pointer transition-all duration-200 text-center hover:-translate-y-0.5 hover:shadow-sm',
              !useCustomTheme
                ? 'border-[#cbb384] bg-[#ddd1b6]/20 ring-1 ring-[#cbb384]/30'
                : 'border-border/60 hover:border-[#cbb384]/40 hover:bg-muted/40'
            )}
            onClick={() => setUseCustomTheme(false)}
          >
            <p
              className={cn(
                'font-semibold text-sm',
                !useCustomTheme ? 'text-[#7a6035] dark:text-[#e4d5b7]' : 'text-foreground'
              )}
            >
              Herdar Padrão
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Configurações da conta</p>
          </div>
          <div
            className={cn(
              'p-3.5 border rounded-xl cursor-pointer transition-all duration-200 text-center hover:-translate-y-0.5 hover:shadow-sm',
              useCustomTheme
                ? 'border-[#cbb384] bg-[#ddd1b6]/20 ring-1 ring-[#cbb384]/30'
                : 'border-border/60 hover:border-[#cbb384]/40 hover:bg-muted/40'
            )}
            onClick={() => setUseCustomTheme(true)}
          >
            <p
              className={cn(
                'font-semibold text-sm',
                useCustomTheme ? 'text-[#7a6035] dark:text-[#e4d5b7]' : 'text-foreground'
              )}
            >
              Personalizar
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Estilo exclusivo</p>
          </div>
        </div>

        {useCustomTheme && (
          <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <ThemeCatalog
              selectedThemeId={activeThemeId}
              onSelect={setActiveThemeId}
              onThemeOverridesChange={setThemeOverrides}
              initialOverrides={themeOverrides}
            />
          </div>
        )}
      </div>

      {/* Capa da Galeria de Entrega (Hero) */}
      <div className="space-y-4 pt-4 border-t border-border/40">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#cbb384]" />
          <Label className="text-base font-semibold">Capa da Galeria (Hero)</Label>
          <span className="text-[10px] uppercase tracking-wider bg-[#ddd1b6]/50 text-[#7a6035] dark:text-[#e4d5b7] px-2.5 py-0.5 rounded-full border border-[#cbb384]/30 font-medium ml-auto">
            Hero
          </span>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Apresentação inicial da galeria para impactar no primeiro acesso.
        </p>
        <CoverCatalog
          selectedCoverId={coverId}
          onSelect={setCoverId}
          inheritLabel={
            settings?.defaultCoverId
              ? `Usar capa padrão do meu estúdio (${
                  COVER_REGISTRY[settings.defaultCoverId]?.name ?? settings.defaultCoverId
                })`
              : 'Usar capa padrão do meu estúdio'
          }
        />
      </div>

      {/* Layout e Espaçamento */}
      <div className="grid gap-6 md:grid-cols-2 pt-4 border-t border-border/40">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Espaçamento do Grid</Label>
            <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-md text-foreground">
              {useCustomTheme ? (themeOverrides?.layout?.gap ?? 8) : photoSpacing}px
            </span>
          </div>
          <Slider
            value={[useCustomTheme ? (themeOverrides?.layout?.gap ?? 8) : photoSpacing]}
            onValueChange={(vals) => {
              if (useCustomTheme) {
                setThemeOverrides({
                  ...themeOverrides,
                  layout: { ...(themeOverrides.layout || {}), gap: vals[0] },
                });
              } else {
                setPhotoSpacing(vals[0]);
              }
            }}
            min={0}
            max={40}
            step={1}
            className="py-1"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">Modo de Cor do Cliente</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={clientMode === 'light' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setClientMode('light')}
              className={cn(
                'gap-1.5 rounded-xl transition-all',
                clientMode === 'light' &&
                  'bg-[#cbb384] hover:bg-[#bfa574] text-white shadow-sm border-transparent'
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              Claro
            </Button>
            <Button
              type="button"
              variant={clientMode === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setClientMode('dark')}
              className={cn(
                'gap-1.5 rounded-xl transition-all',
                clientMode === 'dark' &&
                  'bg-neutral-900 dark:bg-card text-foreground border-[#cbb384]/50 shadow-sm'
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              Escuro
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
