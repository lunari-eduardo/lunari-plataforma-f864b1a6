import React, { useRef } from 'react';
import { BrandData } from '@/services/OnboardingService';
import { Image as ImageIcon, Upload, Trash2, Loader2, Sparkles, Instagram, Building } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepBrandProps {
  data: BrandData;
  onChange: (updates: Partial<BrandData>) => void;
  onUploadLogo: (file: File) => Promise<string | undefined>;
  onRemoveLogo: () => Promise<void>;
  isUploadingLogo: boolean;
}

const BRAND_COLOR_PRESETS = [
  { name: 'Dourado Lunari', color: '#C6A36A' },
  { name: 'Terracota', color: '#C86D51' },
  { name: 'Verde Sálvia', color: '#7A9A8B' },
  { name: 'Azul Clássico', color: '#4A6B82' },
  { name: 'Rosa Nude', color: '#C99B9B' },
  { name: 'Grafite', color: '#2B2B2B' },
];

export function StepBrand({
  data,
  onChange,
  onUploadLogo,
  onRemoveLogo,
  isUploadingLogo,
}: StepBrandProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUploadLogo(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-normal text-white tracking-tight">
          Vamos configurar sua marca
        </h2>
        <p className="text-sm text-white/60 font-light leading-relaxed">
          Essas informações poderão ser usadas nas experiências que seus clientes acessarem pelo Lunari.
        </p>
      </div>

      <div className="space-y-5 pt-1">
        {/* 1. Logomarca */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/80 block">Logomarca do estúdio</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {data.logoUrl ? (
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden p-1.5 shrink-0">
                  <img
                    src={data.logoUrl}
                    alt="Logo do estúdio"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white">Logomarca carregada</p>
                  <p className="text-[11px] text-white/40 font-light">Pronta para uso em contratos e galerias</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10 transition-colors cursor-pointer"
                >
                  Trocar
                </button>
                <button
                  type="button"
                  onClick={onRemoveLogo}
                  disabled={isUploadingLogo}
                  className="p-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Remover logotipo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingLogo}
              className="w-full p-5 rounded-2xl border border-dashed border-white/15 hover:border-[#C6A36A]/60 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer group"
            >
              {isUploadingLogo ? (
                <Loader2 className="w-6 h-6 animate-spin text-[#C6A36A]" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center group-hover:border-[#C6A36A]/40 transition-colors">
                  <Upload className="w-5 h-5 text-white/60 group-hover:text-[#C6A36A] transition-colors" />
                </div>
              )}
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-white/90">
                  {isUploadingLogo ? 'Enviando imagem...' : '+ Adicionar logomarca'}
                </p>
                <p className="text-[11px] text-white/40 font-light">
                  Formatos aceitos: PNG, JPG ou WEBP (máx. 5MB)
                </p>
              </div>
            </button>
          )}
        </div>

        {/* 2. Nome da Marca */}
        <div className="space-y-1.5">
          <label htmlFor="brand-name" className="text-xs font-medium text-white/80">
            Nome da marca / estúdio
          </label>
          <div className="relative">
            <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              id="brand-name"
              type="text"
              value={data.brandName || ''}
              onChange={(e) => onChange({ brandName: e.target.value })}
              placeholder="Ex.: Lise Fotografia"
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-light text-white placeholder:text-white/30 focus:outline-none focus:border-[#C6A36A]/60 focus:bg-white/[0.06] transition-colors"
            />
          </div>
        </div>

        {/* 3. Instagram */}
        <div className="space-y-1.5">
          <label htmlFor="brand-instagram" className="text-xs font-medium text-white/80">
            Instagram da marca
          </label>
          <div className="relative">
            <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              id="brand-instagram"
              type="text"
              value={data.instagram || ''}
              onChange={(e) => onChange({ instagram: e.target.value })}
              placeholder="Ex.: @lisefotografia"
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-light text-white placeholder:text-white/30 focus:outline-none focus:border-[#C6A36A]/60 focus:bg-white/[0.06] transition-colors"
            />
          </div>
        </div>

        {/* 4. Cor da Marca */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C6A36A]" />
              Cor da marca
            </label>
            <span className="text-xs font-mono text-white/50">{data.brandColor || '#C6A36A'}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {BRAND_COLOR_PRESETS.map((preset) => {
              const isSelected =
                (data.brandColor || '#C6A36A').toLowerCase() === preset.color.toLowerCase();
              return (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => onChange({ brandColor: preset.color })}
                  title={preset.name}
                  className={cn(
                    'w-9 h-9 rounded-xl transition-all duration-150 relative cursor-pointer flex items-center justify-center border',
                    isSelected
                      ? 'scale-110 border-white shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                      : 'border-white/10 hover:scale-105'
                  )}
                  style={{ backgroundColor: preset.color }}
                />
              );
            })}

            {/* Color Picker Personalizado */}
            <div className="relative flex items-center ml-2">
              <input
                type="color"
                id="custom-color"
                value={data.brandColor || '#C6A36A'}
                onChange={(e) => onChange({ brandColor: e.target.value })}
                className="w-9 h-9 rounded-xl cursor-pointer bg-transparent border border-white/20 p-0.5"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
