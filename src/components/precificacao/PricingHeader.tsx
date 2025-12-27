import { Calculator, Target, TrendingUp } from 'lucide-react';

export function PricingHeader() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
          <Calculator className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            Central de Precificação
          </h1>
          <p className="text-sm text-muted-foreground">
            Sua jornada estratégica para definir preços rentáveis
          </p>
        </div>
      </div>
      
      {/* Passos visuais */}
      <div className="flex items-center gap-2 pt-4 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 min-w-max">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            <span className="text-xs font-medium">1</span>
            <span className="text-xs">Custos</span>
          </div>
          <div className="w-6 h-0.5 bg-border" />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            <span className="text-xs font-medium">2</span>
            <span className="text-xs">Metas</span>
          </div>
          <div className="w-6 h-0.5 bg-border" />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
            <span className="text-xs font-medium">3</span>
            <span className="text-xs">Calcular</span>
          </div>
        </div>
      </div>
    </div>
  );
}
