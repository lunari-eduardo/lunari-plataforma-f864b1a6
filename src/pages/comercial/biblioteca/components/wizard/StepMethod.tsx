import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, LayoutTemplate, FileText } from 'lucide-react';

interface StepMethodProps {
  creationMethod: 'ai' | 'template' | 'db-template' | 'pdf' | null;
  setCreationMethod: (method: 'ai' | 'template' | 'db-template' | 'pdf') => void;
}

export function StepMethod({ creationMethod, setCreationMethod }: StepMethodProps) {
  return (
    <div className="py-4 space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card IA */}
        <button
          type="button"
          onClick={() => setCreationMethod('ai')}
          className={cn(
            'flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
            creationMethod === 'ai'
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
          )}
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Gerar com IA</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              A inteligência artificial cria a estrutura.
            </p>
          </div>
        </button>

        {/* Card Template DB */}
        <button
          type="button"
          onClick={() => setCreationMethod('db-template')}
          className={cn(
            'flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
            creationMethod === 'db-template'
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
          )}
        >
          <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <LayoutTemplate className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Usar Modelo</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Comece com um modelo premium editável.
            </p>
          </div>
        </button>

        {/* Card PDF */}
        <button
          type="button"
          onClick={() => setCreationMethod('pdf')}
          className={cn(
            'flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
            creationMethod === 'pdf'
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
          )}
        >
          <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
            <FileText className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Importar PDF</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Envie um PDF estático para ser rastreado.
            </p>
          </div>
        </button>

        {/* Card Em Branco */}
        <button
          type="button"
          onClick={() => setCreationMethod('template')}
          className={cn(
            'flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
            creationMethod === 'template'
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
          )}
        >
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Começar do zero</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Comece com uma estrutura limpa.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
