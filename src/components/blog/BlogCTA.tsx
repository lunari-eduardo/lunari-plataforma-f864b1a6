import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * CTA fixo para conversão ao final dos artigos
 */
export function BlogCTA() {
  return (
    <div className="mt-12 p-8 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 rounded-2xl border border-primary/20">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Lunari para Fotógrafos</span>
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            Pronto para transformar seu negócio?
          </h3>
          <p className="text-muted-foreground">
            Organize sua agenda, gerencie clientes e controle suas finanças em um só lugar.
          </p>
        </div>
        <Button
          size="lg"
          className="shrink-0 gap-2"
          onClick={() => window.open('https://www.lunariplataforma.com.br/escolher-plano', '_blank')}
        >
          Começar agora
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
