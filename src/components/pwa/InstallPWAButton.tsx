import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Card } from '@/components/ui/card';

export function InstallPWAButton() {
  const { isInstallable, handleInstallClick } = usePWAInstall();

  // NÃO renderizar se não for instalável
  if (!isInstallable) return null;

  return (
    <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle p-4 mb-6 animate-fade-in bg-gradient-to-r from-brand/10 to-brand-accent/10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-gradient">
            <Download className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-lunar-text">Instalar Lunari</h3>
            <p className="text-2xs text-lunar-textSecondary">
              Acesse mais rápido instalando no seu dispositivo
            </p>
          </div>
        </div>
        <Button 
          onClick={handleInstallClick}
          size="sm"
          className="bg-brand-gradient hover:opacity-90 transition-opacity"
        >
          Instalar
        </Button>
      </div>
    </Card>
  );
}
