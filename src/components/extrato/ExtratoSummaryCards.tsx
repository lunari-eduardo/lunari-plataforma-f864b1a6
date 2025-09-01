/**
 * Cards de resumo do extrato
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResumoExtrato } from '@/types/extrato';
import { formatCurrency } from '@/utils/financialUtils';
import { TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface ExtratoSummaryCardsProps {
  resumo: ResumoExtrato;
}

export default function ExtratoSummaryCards({ resumo }: ExtratoSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {/* ENTRADAS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Entradas</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold text-green-600">
            {formatCurrency(resumo.totalEntradas)}
          </div>
          <p className="text-xs text-muted-foreground">
            Pagas: {formatCurrency(resumo.entradasPagas)}
          </p>
        </CardContent>
      </Card>

      {/* SAÍDAS EFETIVAS (corrigido) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saídas Efetivas</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold text-red-600">
            {formatCurrency(resumo.saidasPagas)}
          </div>
          <p className="text-xs text-muted-foreground">
            Valores já pagos
          </p>
        </CardContent>
      </Card>

      {/* SALDO REAL */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saldo Real</CardTitle>
          <DollarSign className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className={`text-lg font-bold ${resumo.saldoEfetivo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(resumo.saldoEfetivo)}
          </div>
          <p className="text-xs text-muted-foreground">
            Apenas valores pagos
          </p>
        </CardContent>
      </Card>

      {/* SAÍDAS FUTURAS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saídas Futuras</CardTitle>
          <Clock className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold text-orange-600">
            {formatCurrency(resumo.saidasAgendadas)}
          </div>
          <p className="text-xs text-muted-foreground">
            Valores agendados
          </p>
        </CardContent>
      </Card>

      {/* SALDO PROJETADO */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saldo Projetado</CardTitle>
          <AlertCircle className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className={`text-lg font-bold ${resumo.saldoProjetado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(resumo.saldoProjetado)}
          </div>
          <p className="text-xs text-muted-foreground">
            Incluindo futuros
          </p>
        </CardContent>
      </Card>

      {/* TOTAL A RECEBER */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">A Receber</CardTitle>
          <CheckCircle className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold text-yellow-600">
            {formatCurrency(resumo.totalAReceber)}
          </div>
          <p className="text-xs text-muted-foreground">
            {resumo.percentualPago.toFixed(1)}% já pago
          </p>
        </CardContent>
      </Card>
    </div>
  );
}