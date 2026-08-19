import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  hexToHsv,
  hsvToHex,
  hsvToRgb,
  hexToRgb,
  rgbToHex,
  rgbToHsv,
  getContrastColor,
  HSV,
} from '@/lib/colorUtils';
import { Sparkles, Check, Pipette } from 'lucide-react';

interface CustomColorPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentColor: string;
  onApplyColor: (hex: string) => void;
}

// Paletas de inspiração fotográfica / editorial para seleção rápida
const INSPIRATION_PALETTES = [
  { name: 'Naturais & Terra', colors: ['#5C4033', '#8B5A2B', '#A0522D', '#CD853F', '#D2B48C', '#E6D7C3'] },
  { name: 'Minerais & Botânicos', colors: ['#2F4F4F', '#3B5349', '#556B2F', '#4A6B82', '#365369', '#2C3E50'] },
  { name: 'Contemporâneos', colors: ['#1A1A1A', '#2D2D2D', '#4A4A4A', '#6B5B95', '#8E5A78', '#A26769'] },
];

export function CustomColorPickerModal({
  open,
  onOpenChange,
  currentColor,
  onApplyColor,
}: CustomColorPickerModalProps) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(currentColor || '#D1BE9F'));
  const [hexInput, setHexInput] = useState(currentColor || '#D1BE9F');
  const satValRef = useRef<HTMLDivElement>(null);
  const isDraggingSatVal = useRef(false);

  // Sincroniza ao abrir o modal
  useEffect(() => {
    if (open) {
      const initialHex = currentColor || '#D1BE9F';
      setHsv(hexToHsv(initialHex));
      setHexInput(initialHex.toUpperCase());
    }
  }, [open, currentColor]);

  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const contrastText = getContrastColor(currentHex);

  // Manipulação da Área 2D de Saturação e Brilho (Mouse / Touch)
  const updateSatValFromCoords = useCallback((clientX: number, clientY: number) => {
    if (!satValRef.current) return;
    const rect = satValRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const s = Math.round((x / rect.width) * 100);
    const v = Math.round((1 - y / rect.height) * 100);

    setHsv((prev) => {
      const next = { ...prev, s, v };
      setHexInput(hsvToHex(next.h, next.s, next.v));
      return next;
    });
  }, []);

  const handleSatValMouseDown = (e: React.MouseEvent) => {
    isDraggingSatVal.current = true;
    updateSatValFromCoords(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSatVal.current) return;
      updateSatValFromCoords(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      isDraggingSatVal.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSatValTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    updateSatValFromCoords(touch.clientX, touch.clientY);
  };

  const handleSatValTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    updateSatValFromCoords(touch.clientX, touch.clientY);
  };

  const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = parseInt(e.target.value, 10);
    setHsv((prev) => {
      const next = { ...prev, h };
      setHexInput(hsvToHex(next.h, next.s, next.v));
      return next;
    });
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#')) val = `#${val}`;
    setHexInput(val.toUpperCase());

    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
      setHsv(hexToHsv(val));
    }
  };

  const handleRgbChange = (channel: 'r' | 'g' | 'b', valueStr: string) => {
    const num = Math.max(0, Math.min(255, parseInt(valueStr || '0', 10) || 0));
    const nextRgb = { ...rgb, [channel]: num };
    const nextHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
    setHexInput(nextHex);
    setHsv(rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b));
  };

  const handleSelectPreset = (presetHex: string) => {
    setHexInput(presetHex.toUpperCase());
    setHsv(hexToHsv(presetHex));
  };

  const handleConfirm = () => {
    onApplyColor(currentHex);
    onOpenChange(false);
  };

  // Matiz puro para a camada de fundo do Sat/Val Picker
  const pureHueHex = hsvToHex(hsv.h, 100, 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border border-border bg-background shadow-2xl rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Pipette className="w-4 h-4" />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Personalizar Cor da Galeria
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Selecione ou insira o código da cor exata da identidade visual do seu estúdio.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Área 2D de Saturação & Brilho */}
          <div
            ref={satValRef}
            onMouseDown={handleSatValMouseDown}
            onTouchStart={handleSatValTouchStart}
            onTouchMove={handleSatValTouchMove}
            className="relative w-full h-44 rounded-xl cursor-crosshair overflow-hidden shadow-inner select-none touch-none border border-border/40"
            style={{ backgroundColor: pureHueHex }}
          >
            {/* Gradiente Branco Horizontal (Saturação) */}
            <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
            {/* Gradiente Preto Vertical (Brilho/Valor) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />

            {/* Ponto / Cursor indicador */}
            <div
              className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_4px_rgba(0,0,0,0.6)] pointer-events-none transition-transform"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                backgroundColor: currentHex,
              }}
            />
          </div>

          {/* Slider de Matiz (Hue Rainbow) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
              <span>Matiz (Tom)</span>
              <span>{hsv.h}°</span>
            </div>
            <div className="relative h-6 rounded-lg overflow-hidden border border-border/40">
              <input
                type="range"
                min="0"
                max="360"
                value={hsv.h}
                onChange={handleHueChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                className="w-full h-full"
                style={{
                  background:
                    'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                }}
              />
              {/* Indicador do Slider */}
              <div
                className="absolute top-0 bottom-0 w-3 -translate-x-1/2 border-2 border-white rounded-md shadow-md pointer-events-none"
                style={{
                  left: `${(hsv.h / 360) * 100}%`,
                  backgroundColor: pureHueHex,
                }}
              />
            </div>
          </div>

          {/* Inputs de Cor (HEX e RGB) */}
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-5 space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">HEX</Label>
              <div className="relative">
                <Input
                  value={hexInput}
                  onChange={handleHexChange}
                  maxLength={7}
                  className="font-mono text-xs font-semibold uppercase h-9 bg-muted/40 border-border/70"
                />
              </div>
            </div>

            <div className="col-span-7 grid grid-cols-3 gap-1.5">
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-muted-foreground text-center block">R</Label>
                <Input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.r}
                  onChange={(e) => handleRgbChange('r', e.target.value)}
                  className="font-mono text-xs text-center h-9 px-1 bg-muted/40 border-border/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-muted-foreground text-center block">G</Label>
                <Input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.g}
                  onChange={(e) => handleRgbChange('g', e.target.value)}
                  className="font-mono text-xs text-center h-9 px-1 bg-muted/40 border-border/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-muted-foreground text-center block">B</Label>
                <Input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.b}
                  onChange={(e) => handleRgbChange('b', e.target.value)}
                  className="font-mono text-xs text-center h-9 px-1 bg-muted/40 border-border/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>

          {/* Demonstração em tempo real na galeria */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg shadow-sm border border-black/10 flex items-center justify-center shrink-0"
                style={{ backgroundColor: currentHex }}
              >
                <Check className="w-4 h-4" style={{ color: contrastText }} />
              </div>
              <div>
                <p className="text-xs font-semibold leading-tight">Visualização do Botão</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Como o cliente verá os botões da galeria
                </p>
              </div>
            </div>

            <div
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide shadow-xs select-none"
              style={{
                backgroundColor: currentHex,
                color: contrastText,
              }}
            >
              Confirmar
            </div>
          </div>

          {/* Paletas de Inspiração */}
          <div className="space-y-2 pt-1 border-t border-border/40">
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>Tons de Inspiração Editorial</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {INSPIRATION_PALETTES.flatMap((p) => p.colors).map((color) => {
                const isSelected = currentHex.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleSelectPreset(color)}
                    className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 flex items-center justify-center ${
                      isSelected ? 'ring-2 ring-primary ring-offset-1 border-transparent scale-110' : 'border-black/10'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 stroke-[3]" style={{ color: getContrastColor(color) }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/60 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="terracotta"
            size="sm"
            onClick={handleConfirm}
            className="text-xs shadow-sm px-4"
          >
            Aplicar Cor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
