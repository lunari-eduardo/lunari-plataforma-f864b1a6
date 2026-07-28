import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Moon, Sun, RotateCcw, Sparkles } from 'lucide-react';
import { useVisualTheme } from '@/contexts/VisualThemeContext';
import { cn } from '@/lib/utils';
import type { VisualThemeMode } from '@/lib/visualTheme';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODES: { value: VisualThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light',  label: 'Claro',   icon: <Sun className="h-3.5 w-3.5" /> },
  { value: 'dark',   label: 'Escuro',  icon: <Moon className="h-3.5 w-3.5" /> },
  { value: 'system', label: 'Sistema', icon: <Monitor className="h-3.5 w-3.5" /> },
];

export function AppearanceModal({ open, onOpenChange }: Props) {
  const { theme, setMode, reset } = useVisualTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Aparência</DialogTitle>
          <DialogDescription className="text-xs">
            O Lunari tem uma identidade única. Escolha apenas o modo de exibição.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Identidade única */}
          <section>
            <div className="text-xs font-medium text-muted-foreground mb-2">Tema</div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background">
                <Sparkles className="h-4 w-4" style={{ color: 'hsl(var(--accent-gold))' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">Lunari Grafite</div>
                <div className="text-[11px] text-muted-foreground leading-tight">
                  Grafite institucional com detalhes em dourado.
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">Oficial</Badge>
            </div>
          </section>

          {/* Modo */}
          <section>
            <div className="text-xs font-medium text-muted-foreground mb-2">Modo</div>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => {
                const selected = theme.mode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium border transition-all',
                      selected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    )}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Preview */}
          <section>
            <div className="text-xs font-medium text-muted-foreground mb-2">Pré-visualização</div>
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-foreground">Lunari Studio</div>
                <Badge>Premium</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Textos, ícones e botões mantêm contraste em ambos os modos.
              </p>
              <div className="flex gap-2 pt-1">
                <Button size="sm">Primário</Button>
                <Button size="sm" variant="outline">Secundário</Button>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={reset} className="text-xs">
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Restaurar padrão
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)}>Concluir</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
