import React from 'react';
import { Eye, X, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VisualRenderer } from '../VisualRenderer';
import { ProposalDesignTokens } from '../../../blocks/design';
import { BlockData } from '@/hooks/useMaterialEditor';

interface FullscreenPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  format: 'blocks' | 'pdf';
  blocks: BlockData[];
  pdfUrl?: string;
  viewMode: 'desktop' | 'mobile';
  setViewMode: (mode: 'desktop' | 'mobile') => void;
  designTokens?: ProposalDesignTokens;
}

export function FullscreenPreviewModal({
  isOpen,
  onClose,
  title,
  format,
  blocks,
  pdfUrl,
  viewMode,
  setViewMode,
  designTokens,
}: FullscreenPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col overflow-hidden animate-in fade-in">
      <div className="h-14 border-b bg-background/50 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Pré-visualização: {title}</span>
        </div>

        {/* Toggle no meio do preview */}
        <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('desktop')}
            className={cn(
              'h-8 px-3 rounded-md',
              viewMode === 'desktop' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
            )}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('mobile')}
            className={cn(
              'h-8 px-3 rounded-md',
              viewMode === 'mobile' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
            )}
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={onClose} className="gap-2">
          Fechar Preview <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Renderiza VisualRenderer ou Iframe para Preview */}
      <div className="flex-1 overflow-y-auto bg-muted/30 flex justify-center py-8">
        {format === 'blocks' ? (
          <VisualRenderer
            blocks={blocks}
            activeIndex={-1}
            onSelectBlock={() => {}}
            viewMode={viewMode}
            mode="public"
            designTokens={designTokens}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-background">
            <iframe
              className="w-full h-full max-w-[1200px] border-none bg-white shadow-xl"
              title="PDF Preview"
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
