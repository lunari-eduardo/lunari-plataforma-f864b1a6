import React from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

interface StepPdfUploadProps {
  onBack: () => void;
  selectedPdf: File | null;
  setSelectedPdf: (file: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export function StepPdfUpload({
  onBack,
  selectedPdf,
  setSelectedPdf,
  fileInputRef,
}: StepPdfUploadProps) {
  return (
    <div className="py-4 space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground transition-colors underline underline-offset-2"
        >
          ← Voltar
        </button>
      </div>

      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl bg-card">
        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <UploadCloud className="h-6 w-6 text-red-600" />
        </div>

        {selectedPdf ? (
          <div className="text-center">
            <p className="font-medium text-sm">{selectedPdf.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(selectedPdf.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSelectedPdf(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              Trocar arquivo
            </Button>
          </div>
        ) : (
          <>
            <h3 className="font-medium text-sm mb-1">Selecione o arquivo PDF</h3>
            <p className="text-xs text-muted-foreground text-center max-w-[250px] mb-4">
              Tamanho máximo: 50MB. O arquivo será otimizado para carregamento rápido.
            </p>
            <Button onClick={() => fileInputRef.current?.click()} variant="secondary">
              Procurar Arquivo
            </Button>
          </>
        )}

        <input
          type="file"
          ref={fileInputRef}
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              const file = e.target.files[0];
              if (file.size > 50 * 1024 * 1024) {
                toast.error('O arquivo é muito grande. O limite é 50MB.');
                return;
              }
              setSelectedPdf(file);
            }
          }}
        />
      </div>
    </div>
  );
}
