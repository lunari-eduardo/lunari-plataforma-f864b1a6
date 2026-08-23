import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = (error.message || error.toString() || '').toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('dynamically imported module')
  );
}

export class RootErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("RootErrorBoundary pegou um erro:", error, errorInfo);

    // Auto-recuperação para chunks obsoletos pós-deploy
    if (isChunkLoadError(error)) {
      const key = 'chunk_auto_reload_ts';
      const last = Number(sessionStorage.getItem(key) || '0');
      if (Date.now() - last > 15_000) {
        sessionStorage.setItem(key, String(Date.now()));
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(r => r.update());
          });
        }
        window.location.reload();
      }
    }
  }

  handleClearCacheAndReload = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
    } catch (e) {
      console.warn('Erro ao limpar caches:', e);
    } finally {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const isChunk = isChunkLoadError(this.state.error);

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            {isChunk ? 'Atualização disponível' : 'Algo deu errado'}
          </h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            {isChunk
              ? 'Uma nova versão do Lunari Studio foi publicada. Clique em Atualizar para carregar os arquivos mais recentes.'
              : 'O aplicativo encontrou um erro inesperado ao carregar. Por favor, recarregue a página.'}
          </p>
          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {isChunk ? 'Atualizar Agora' : 'Recarregar'}
            </Button>
            <Button variant="outline" onClick={this.handleClearCacheAndReload}>
              Limpar Cache e Atualizar
            </Button>
          </div>
          <div className="mt-8 p-4 bg-muted rounded-md text-left text-xs max-w-2xl overflow-auto w-full">
            <h2 className="font-bold mb-2">Detalhes técnicos:</h2>
            <pre className="whitespace-pre-wrap">
              {this.state.error?.toString()}
              {"\n\n"}
              {this.state.error?.stack}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
