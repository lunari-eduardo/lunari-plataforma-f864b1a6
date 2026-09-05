import React from 'react';
import { cn } from '@/lib/utils';

interface ClientGalleryLoadingProps {
  themeStyles: React.CSSProperties;
  studioLogoUrl?: string | null;
  isRedirecting?: boolean;
  effectiveBackgroundMode?: 'light' | 'dark';
}

export function ClientGalleryLoading({
  themeStyles,
  studioLogoUrl,
  isRedirecting,
  effectiveBackgroundMode = 'light',
}: ClientGalleryLoadingProps) {
  if (isRedirecting) {
    return (
      <div
        className={cn(
          'min-h-screen flex flex-col items-center justify-center bg-background text-foreground',
          effectiveBackgroundMode === 'dark' && 'dark'
        )}
        style={themeStyles}
        aria-live="polite"
      >
        {studioLogoUrl && (
          <img
            src={studioLogoUrl}
            alt=""
            className="h-14 max-w-[180px] object-contain mb-8 opacity-80"
          />
        )}
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="mt-6 text-base font-medium">Abrindo checkout...</p>
        <p className="mt-1 text-sm text-muted-foreground">Você será redirecionado em instantes.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background" style={themeStyles}>
      {studioLogoUrl && (
        <img 
          src={studioLogoUrl} 
          alt="" 
          className="h-14 max-w-[180px] object-contain mb-6 opacity-60"
        />
      )}
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="mt-4 text-sm text-muted-foreground">Carregando galeria...</p>
    </div>
  );
}
