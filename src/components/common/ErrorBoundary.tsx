import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Boundary defensivo para isolar páginas/seções de crashes de render.
 * Evita que um único erro em uma sessão/card pinte a tela inteira de branco.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ' • ' + this.props.label : ''}]`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-lg border border-destructive/30 bg-destructive/5 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div>
          <p className="font-semibold">Algo deu errado ao carregar esta seção</p>
          <p className="text-sm text-muted-foreground mt-1">
            {this.state.error?.message || 'Erro inesperado'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={this.handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
          <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
            Recarregar página
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
