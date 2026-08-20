import { useState } from 'react';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TitleCaseMode } from '@/types/gallery';
import { applyTitleCase } from '@/lib/textTransform';

interface PasswordScreenProps {
  sessionName?: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  studioName?: string;
  studioLogo?: string;
  onSubmit: (password: string) => Promise<void>;
  error?: string;
  isLoading?: boolean;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

export function PasswordScreen({
  sessionName,
  sessionFont,
  titleCaseMode = 'normal',
  studioName,
  studioLogo,
  onSubmit,
  error,
  isLoading = false,
  themeStyles = {},
  backgroundMode = 'light',
}: PasswordScreenProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      await onSubmit(password.trim());
    }
  };

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col relative overflow-hidden bg-background text-foreground",
        backgroundMode === 'dark' && 'dark'
      )}
      style={themeStyles}
    >
      {/* Dynamic Background with Blur */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 bg-cover bg-center scale-110 blur-3xl opacity-15 transition-opacity duration-1000"
          style={{ backgroundImage: `url(${studioLogo || ''})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-center p-8 md:p-12">
          {studioLogo ? (
            <img 
              src={studioLogo} 
              alt={studioName || 'Studio'} 
              className="h-28 md:h-36 lg:h-44 w-auto object-contain animate-fade-in"
            />
          ) : (
            <span className="text-xl tracking-[0.2em] uppercase font-light opacity-60">
              {studioName}
            </span>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-md w-full text-center space-y-8 animate-slide-up">
            {/* Title Section */}
            <div className="space-y-3">
              <div 
                className="inline-flex items-center justify-center p-3 rounded-full mb-2 border"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--gallery-primary, #C6A36A) 12%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--gallery-primary, #C6A36A) 25%, transparent)',
                  color: 'var(--gallery-primary, #C6A36A)',
                }}
              >
                <Lock className="h-5 w-5" />
              </div>
              
              <h2 className="text-xs md:text-sm font-medium tracking-[0.25em] uppercase text-muted-foreground">
                Sua galeria está pronta
              </h2>
              
              {sessionName && (
                <h1 
                  className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-foreground"
                  style={{ fontFamily: sessionFont || 'inherit' }}
                >
                  {applyTitleCase(sessionName, titleCaseMode)}
                </h1>
              )}
            </div>

            {/* Password Form Card */}
            <div className="p-6 sm:p-10 space-y-6 shadow-2xl rounded-2xl max-w-md mx-auto bg-card/90 border border-border/40 backdrop-blur-xl">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2 text-left">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground ml-1 font-semibold">
                    Senha de Acesso
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(
                        "bg-muted/40 border-border text-center text-lg h-14 tracking-[0.3em] rounded-xl transition-all pl-10 text-foreground placeholder:text-muted-foreground/40",
                        error && "border-destructive focus-visible:ring-destructive"
                      )}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                  
                  {error && (
                    <div className="flex items-center justify-center gap-2 text-destructive text-sm mt-2 animate-shake">
                      <AlertCircle className="h-4 w-4" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>

                <Button 
                  type="submit" 
                  variant="default" 
                  size="lg"
                  className="w-full shadow-lg transition-all duration-300 rounded-xl h-13 text-sm font-medium tracking-wide"
                  disabled={isLoading || !password.trim()}
                  style={{ 
                    backgroundColor: 'var(--gallery-primary, #C6A36A)',
                    color: 'var(--gallery-primary-fg, #0E0E0E)',
                    borderRadius: 'var(--gallery-radius)'
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Acessar Galeria'
                  )}
                </Button>
              </form>

              <p className="text-xs text-muted-foreground">
                Conteúdo exclusivo e protegido para sua privacidade.
              </p>
            </div>
          </div>
        </main>

        {/* Footer Info */}
        <footer className="p-8 text-center opacity-20 text-[10px] uppercase tracking-[0.3em] font-light">
          Experience by Lunari
        </footer>
      </div>
    </div>
  );
}
