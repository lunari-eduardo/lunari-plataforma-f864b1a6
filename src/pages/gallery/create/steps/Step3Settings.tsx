import { Image, Droplet, Palette, Sun, Moon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageResizeOption, WatermarkType, SaleMode } from '@/types/gallery';

export interface Step3SettingsProps {
  imageResizeOption: ImageResizeOption;
  setImageResizeOption: (v: ImageResizeOption) => void;
  onImageResizeTouched?: () => void;
  watermarkType: WatermarkType;
  setWatermarkType: (v: WatermarkType) => void;
  watermarkOpacity: number;
  setWatermarkOpacity: (v: number) => void;
  clientMode: 'light' | 'dark';
  setClientMode: (v: 'light' | 'dark') => void;
  onClientModeTouched?: () => void;
  allowComments: boolean;
  setAllowComments: (v: boolean) => void;
  onAllowCommentsTouched?: () => void;
  allowDownload: boolean;
  setAllowDownload: (v: boolean) => void;
  onAllowDownloadTouched?: () => void;
  allowExtraPhotos: boolean;
  setAllowExtraPhotos: (v: boolean) => void;
  onAllowExtraPhotosTouched?: () => void;
  saleMode: SaleMode;
}

export function Step3Settings({
  imageResizeOption,
  setImageResizeOption,
  onImageResizeTouched,
  watermarkType,
  setWatermarkType,
  watermarkOpacity,
  setWatermarkOpacity,
  clientMode,
  setClientMode,
  onClientModeTouched,
  allowComments,
  setAllowComments,
  onAllowCommentsTouched,
  allowDownload,
  setAllowDownload,
  onAllowDownloadTouched,
  allowExtraPhotos,
  setAllowExtraPhotos,
  onAllowExtraPhotosTouched,
  saleMode,
}: Step3SettingsProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-muted-foreground text-xl">
          Personalize a experiência do cliente
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Block - Image Settings & Watermark */}
        <div className="space-y-6">
          {/* Image Resize */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              <Label>Tamanho das Imagens</Label>
            </div>
            <Select
              value={String(imageResizeOption)}
              onValueChange={(v) => {
                onImageResizeTouched?.();
                setImageResizeOption(parseInt(v) as ImageResizeOption);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1024">1024 px</SelectItem>
                <SelectItem value="1920">1920 px (recomendado)</SelectItem>
                <SelectItem value="2560">2560 px (4K)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Aresta longa • Fotos são redimensionadas proporcionalmente
            </p>
          </div>

          {/* Watermark */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Droplet className="h-4 w-4 text-primary" />
              <Label>Proteção da Imagem</Label>
            </div>

            <RadioGroup
              value={watermarkType}
              onValueChange={(v) => setWatermarkType(v as WatermarkType)}
              className="flex flex-wrap gap-2"
            >
              <div className="flex items-center">
                <RadioGroupItem value="standard" id="wm-standard" className="peer sr-only" />
                <Label
                  htmlFor="wm-standard"
                  className="px-3 py-1.5 text-sm rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                >
                  Padrão do Sistema
                </Label>
              </div>
              <div className="flex items-center">
                <RadioGroupItem value="custom" id="wm-custom" className="peer sr-only" />
                <Label
                  htmlFor="wm-custom"
                  className="px-3 py-1.5 text-sm rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                >
                  Minha Marca
                </Label>
              </div>
              <div className="flex items-center">
                <RadioGroupItem value="none" id="wm-none" className="peer sr-only" />
                <Label
                  htmlFor="wm-none"
                  className="px-3 py-1.5 text-sm rounded-lg border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary"
                >
                  Nenhuma
                </Label>
              </div>
            </RadioGroup>

            {/* Watermark Preview / Opacity */}
            {(watermarkType === 'standard' || watermarkType === 'custom') && (
              <div className="space-y-4 p-3 rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Opacidade</Label>
                    <span className="text-sm font-medium text-muted-foreground">
                      {watermarkOpacity}%
                    </span>
                  </div>
                  <Slider
                    value={[watermarkOpacity]}
                    onValueChange={(value) => setWatermarkOpacity(value[0])}
                    min={10}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Block - Appearance & Interactions */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm">Aparência da Galeria</h3>
            </div>

            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <Label className="text-sm">Fundo desta galeria</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  As cores do seu tema serão aplicadas sobre o fundo escolhido.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  type="button"
                  variant={clientMode === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    onClientModeTouched?.();
                    setClientMode('light');
                  }}
                  className="gap-1"
                >
                  <Sun className="h-3.5 w-3.5" />
                  Claro
                </Button>
                <Button
                  type="button"
                  variant={clientMode === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    onClientModeTouched?.();
                    setClientMode('dark');
                  }}
                  className="gap-1"
                >
                  <Moon className="h-3.5 w-3.5" />
                  Escuro
                </Button>
              </div>
            </div>
          </div>

          {/* Client Interactions */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Interações do Cliente</h3>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Permitir comentários</p>
                <p className="text-xs text-muted-foreground">
                  Cliente pode comentar em cada foto
                </p>
              </div>
              <Switch
                checked={allowComments}
                onCheckedChange={(v) => {
                  onAllowCommentsTouched?.();
                  setAllowComments(v);
                }}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Permitir download</p>
                <p className="text-xs text-muted-foreground">
                  Cliente pode baixar as imagens
                </p>
              </div>
              <Switch
                checked={allowDownload}
                onCheckedChange={(v) => {
                  onAllowDownloadTouched?.();
                  setAllowDownload(v);
                }}
              />
            </div>

            {saleMode !== 'no_sale' && (
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Permitir fotos extras</p>
                  <p className="text-xs text-muted-foreground">
                    Cliente pode selecionar além do limite
                  </p>
                </div>
                <Switch
                  checked={allowExtraPhotos}
                  onCheckedChange={(v) => {
                    onAllowExtraPhotosTouched?.();
                    setAllowExtraPhotos(v);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
