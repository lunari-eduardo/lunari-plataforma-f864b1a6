import { Image as ImageIcon, Download } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GlobalSettings, ImageResizeOption } from '@/types/gallery';
import { UpdateSettingsOptions } from '@/hooks/useGallerySettings';

interface DefaultsImagesTabProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>, options?: UpdateSettingsOptions) => void;
}

export function DefaultsImagesTab({ settings, updateSettings }: DefaultsImagesTabProps) {
  return (
    <div className="space-y-6">
      {/* Default Image Resize */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Tamanho Padrão das Imagens</h2>
            <p className="text-sm text-muted-foreground">
              Resolução do preview aplicada automaticamente em novas galerias
            </p>
          </div>
        </div>

        <RadioGroup
          value={String(settings.defaultImageResize ?? 1920)}
          onValueChange={(v) => updateSettings({ defaultImageResize: Number(v) as ImageResizeOption }, { successMessage: 'Tamanho padrão salvo.' })}
          className="space-y-3"
        >
          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="1024" id="resize-1024" className="mt-0.5" />
            <Label htmlFor="resize-1024" className="flex-1 cursor-pointer">
              <p className="font-medium">1024 px</p>
              <p className="text-sm text-muted-foreground">
                Leve, ideal para web e carregamento rápido
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="1920" id="resize-1920" className="mt-0.5" />
            <Label htmlFor="resize-1920" className="flex-1 cursor-pointer">
              <p className="font-medium">1920 px <span className="text-xs text-primary ml-1">(recomendado)</span></p>
              <p className="text-sm text-muted-foreground">
                Equilíbrio ideal entre qualidade e peso
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="2560" id="resize-2560" className="mt-0.5" />
            <Label htmlFor="resize-2560" className="flex-1 cursor-pointer">
              <p className="font-medium">2560 px</p>
              <p className="text-sm text-muted-foreground">
                Alta resolução para visualização em telas grandes
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Opções de Download</h2>
            <p className="text-sm text-muted-foreground">
              Comportamento de entrega de fotos aplicados em novas galerias
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <div className="flex items-start gap-4">
              <Download className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="allow-download" className="font-medium cursor-pointer">
                  Permitir Download Original
                </Label>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Permite que os clientes baixem os arquivos em alta resolução de acordo com a seleção ou pacotes.
                </p>
              </div>
            </div>
            <Switch
              id="allow-download"
              checked={settings.defaultAllowDownload ?? false}
              onCheckedChange={(v) => updateSettings({ defaultAllowDownload: v }, { successMessage: 'Comportamento padrão salvo.' })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
