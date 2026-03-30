import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QrCode, Link2, XCircle, Eye, TrendingUp, Loader2 } from 'lucide-react';
import { Cobranca, TipoCobranca, StatusCobranca } from '@/types/cobranca';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ChargeHistoryProps {
  cobrancas: Cobranca[];
  onCancel: (id: string) => void;
  onView?: (cobranca: Cobranca) => void;
}

const tipoIcons: Record<TipoCobranca, React.ReactNode> = {
  pix: <QrCode className="h-4 w-4" />,
  link: <Link2 className="h-4 w-4" />,
};

const tipoLabels: Record<TipoCobranca, string> = {
  pix: 'Pix',
  link: 'Link',
};

const statusBadges: Record<StatusCobranca, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pendente: { variant: 'secondary', label: 'Aguardando' },
  parcialmente_pago: { variant: 'secondary', label: 'Parcial' },
  pago: { variant: 'default', label: 'Pago' },
  cancelado: { variant: 'outline', label: 'Cancelado' },
  expirado: { variant: 'destructive', label: 'Expirado' },
};

interface SimulationData {
  anticipableValue: number;
  fee: number;
  netValue: number;
  estimatedCreditDate: string;
}

export function ChargeHistory({ cobrancas, onCancel, onView }: ChargeHistoryProps) {
  const [simulating, setSimulating] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<{ cobrancaId: string; data: SimulationData; valorOriginal: number } | null>(null);

  const handleSimulate = async (cobranca: Cobranca) => {
    setSimulating(cobranca.id);
    try {
      const response = await supabase.functions.invoke('gestao-asaas-anticipation', {
        body: { action: 'simulate', cobrancaId: cobranca.id },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro na simulação');

      setSimulation({
        cobrancaId: cobranca.id,
        data: response.data.simulation,
        valorOriginal: cobranca.valor,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao simular antecipação');
    } finally {
      setSimulating(null);
    }
  };

  const handleRequest = async () => {
    if (!simulation) return;
    setRequesting(simulation.cobrancaId);
    try {
      const response = await supabase.functions.invoke('gestao-asaas-anticipation', {
        body: { action: 'request', cobrancaId: simulation.cobrancaId },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro ao solicitar');

      toast.success('Antecipação solicitada com sucesso!');
      setSimulation(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao solicitar antecipação');
    } finally {
      setRequesting(null);
    }
  };

  const canAnticipate = (c: Cobranca) =>
    c.provedor === 'asaas' && c.status === 'pago' && c.tipoCobranca === 'link';

  if (cobrancas.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p className="text-sm">Nenhuma cobrança registrada</p>
      </div>
    );
  }

  return (
    <>
      <div className="-mx-2 px-2 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Data</TableHead>
              <TableHead className="text-xs">Valor</TableHead>
              <TableHead className="text-xs">Forma</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cobrancas.map((cobranca) => {
              const statusConfig = statusBadges[cobranca.status];
              
              return (
                <TableRow key={cobranca.id}>
                  <TableCell className="text-sm">
                    {formatDateForDisplay(cobranca.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{formatCurrency(cobranca.valor)}</span>
                      {cobranca.valorLiquido != null && cobranca.valorLiquido !== cobranca.valor && 
                       !(cobranca.dadosExtras?.repassarTaxasProcessamento === true) && (
                        <p className="text-xs text-muted-foreground">
                          Líquido: {formatCurrency(cobranca.valorLiquido)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {tipoIcons[cobranca.tipoCobranca]}
                      <span className="text-xs">{tipoLabels[cobranca.tipoCobranca]}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={statusConfig.variant}
                      className={
                        cobranca.status === 'pago' ? 'bg-green-100 text-green-800 border-green-200' :
                        cobranca.status === 'parcialmente_pago' ? 'bg-amber-100 text-amber-800 border-amber-200' : ''
                      }
                    >
                      {statusConfig.label}
                      {cobranca.status === 'parcialmente_pago' && cobranca.totalParcelas && cobranca.totalParcelas > 1
                        ? ` (${cobranca.parcelasPagas || 0}/${cobranca.totalParcelas})`
                        : cobranca.status === 'pago' && cobranca.totalParcelas && cobranca.totalParcelas > 1
                        ? ` (${cobranca.parcelasPagas || cobranca.totalParcelas}/${cobranca.totalParcelas})`
                        : ''
                      }
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {onView && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onView(cobranca)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {canAnticipate(cobranca) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSimulate(cobranca)}
                          disabled={simulating === cobranca.id}
                          className="h-8 w-8 p-0 text-primary hover:text-primary"
                          title="Simular antecipação"
                        >
                          {simulating === cobranca.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {cobranca.status === 'pendente' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onCancel(cobranca.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Anticipation Simulation Dialog */}
      <Dialog open={!!simulation} onOpenChange={() => setSimulation(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Simulação de Antecipação
            </DialogTitle>
          </DialogHeader>
          {simulation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Valor original</p>
                  <p className="font-semibold">{formatCurrency(simulation.valorOriginal)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Valor antecipável</p>
                  <p className="font-semibold">{formatCurrency(simulation.data.anticipableValue)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Taxa de antecipação</p>
                  <p className="font-semibold text-destructive">- {formatCurrency(simulation.data.fee)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Valor líquido</p>
                  <p className="font-semibold text-primary">{formatCurrency(simulation.data.netValue)}</p>
                </div>
              </div>

              {simulation.data.estimatedCreditDate && (
                <p className="text-xs text-muted-foreground text-center">
                  Previsão de crédito: {formatDateForDisplay(simulation.data.estimatedCreditDate)}
                </p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSimulation(null)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleRequest}
                  disabled={!!requesting}
                >
                  {requesting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Confirmar Antecipação
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
