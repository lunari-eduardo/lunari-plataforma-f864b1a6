import { useNavigate } from 'react-router-dom';
import { HardDrive, ArrowUpCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatStorageSize } from '@/lib/transferPlans';

interface DeliverStorageExceededProps {
  storageLimitBytes: number;
  storageUsedBytes: number;
  storageUsedPercent: number;
  isUnlimited: boolean;
  planName?: string;
}

export function DeliverStorageExceeded({
  storageLimitBytes,
  storageUsedBytes,
  storageUsedPercent,
  isUnlimited,
  planName,
}: DeliverStorageExceededProps) {
  const navigate = useNavigate();
  const hasTransferPlan = !isUnlimited && storageLimitBytes > 0;

  return (
    <div className="max-w-lg mx-auto py-16 space-y-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
        <HardDrive className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Armazenamento Esgotado</h2>
        <p className="text-sm text-muted-foreground">
          Você atingiu o limite de {formatStorageSize(storageLimitBytes)} do seu plano. Para criar novas
          galerias de entrega, faça upgrade do seu plano ou exclua galerias antigas.
        </p>
      </div>

      <div className="p-4 rounded-lg bg-muted/50 space-y-2 text-left">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Uso atual</span>
          <span>{storageUsedPercent.toFixed(0)}%</span>
        </div>
        <Progress value={Math.min(storageUsedPercent, 100)} className="h-2" />
        <p className="text-xs text-muted-foreground text-center">
          {formatStorageSize(storageUsedBytes)} de {formatStorageSize(storageLimitBytes)} usados
          {planName && <span className="ml-1">· {planName}</span>}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <Button onClick={() => navigate('/app/gallery/settings')} className="gap-2">
          <ArrowUpCircle className="w-4 h-4" />
          {hasTransferPlan ? 'Fazer Upgrade' : 'Ver Planos'}
        </Button>
        {hasTransferPlan && (
          <Button
            variant="outline"
            onClick={() => navigate('/app/gallery/list?tab=transfer')}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Gerenciar Galerias
          </Button>
        )}
      </div>
    </div>
  );
}
