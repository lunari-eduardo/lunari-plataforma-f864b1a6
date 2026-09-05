import React from 'react';
import { Clock } from 'lucide-react';
import { applyTitleCase } from '@/lib/textTransform';
import { TitleCaseMode } from '@/types/gallery';

interface ClientGalleryExpiredProps {
  themeStyles: React.CSSProperties;
  sessionName: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  studioLogoUrl?: string | null;
  studioName?: string | null;
}

export function ClientGalleryExpired({
  themeStyles,
  sessionName,
  sessionFont,
  titleCaseMode = 'normal',
  studioLogoUrl,
  studioName,
}: ClientGalleryExpiredProps) {
  const expiredBgStyle: React.CSSProperties = {
    ...themeStyles,
    backgroundColor: 'var(--gallery-bg, #FAF9F7)',
    color: 'var(--gallery-text, #1A1614)',
    fontFamily: sessionFont || 'Inter, system-ui, sans-serif',
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={expiredBgStyle}
    >
      {studioLogoUrl && (
        <div className="mb-10">
          <img
            src={studioLogoUrl}
            alt={studioName || 'Studio'}
            style={{ height: '80px', maxWidth: '240px', objectFit: 'contain', margin: '0 auto', display: 'block' }}
          />
        </div>
      )}

      <div className="max-w-sm w-full text-center space-y-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: 'var(--gallery-bg-elevated, #F0EDE9)' }}
        >
          <Clock className="h-9 w-9" style={{ color: 'var(--gallery-text-muted, #6B6560)' }} />
        </div>

        {sessionName && (
          <p
            className="text-sm tracking-widest uppercase"
            style={{ color: 'var(--gallery-text-muted, #6B6560)', fontWeight: 400 }}
          >
            {applyTitleCase(sessionName, titleCaseMode)}
          </p>
        )}

        <div className="space-y-4">
          <h1
            className="text-2xl"
            style={{ color: 'var(--gallery-text, #1A1614)', fontWeight: 600 }}
          >
            Galeria expirada
          </h1>
          <p
            className="text-base leading-relaxed"
            style={{ color: 'var(--gallery-text-muted, #6B6560)', fontWeight: 400 }}
          >
            O prazo de acesso à galeria expirou.
          </p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--gallery-text-muted, #6B6560)', fontWeight: 400 }}
          >
            Para visualizar novamente, entre em contato com o fotógrafo e solicite a liberação.
          </p>
        </div>

        {!studioLogoUrl && studioName && (
          <p
            className="text-xs pt-4"
            style={{ color: 'var(--gallery-text-muted, #6B6560)', borderTop: '1px solid var(--gallery-border, #DAD6D1)', fontWeight: 400 }}
          >
            {studioName}
          </p>
        )}
      </div>
    </div>
  );
}
