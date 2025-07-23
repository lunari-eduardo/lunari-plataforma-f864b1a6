
import { CreditCard, ArrowUpRight, Clock } from "lucide-react";

type FinancialSummaryProps = {
  revenue: number;
  forecasted: number;
  outstanding: number;
  sessionCount: number;
  prevMonthRevenue?: number;
  prevMonthForecasted?: number;
  prevMonthOutstanding?: number;
  prevMonthSessionCount?: number;
  compact?: boolean;
}

export function FinancialSummary({
  revenue,
  forecasted,
  outstanding,
  sessionCount,
  prevMonthRevenue,
  prevMonthForecasted,
  prevMonthOutstanding,
  prevMonthSessionCount,
  compact = false
}: FinancialSummaryProps) {
  
  // Calculate percentage change compared to previous month
  const calculatePercentChange = (current: number, previous?: number) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return change.toFixed(1);
  };

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  // Render a change indicator with arrow
  const renderChange = (current: number, previous?: number) => {
    const change = calculatePercentChange(current, previous);
    if (change === null) return null;
    
    const isPositive = Number(change) > 0;
    return (
      <div className={`flex items-center ${compact ? 'text-xs' : 'text-xs'} ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUpRight className={`${compact ? 'h-3 w-3' : 'h-3 w-3'} mr-1`} /> : <ArrowUpRight className={`${compact ? 'h-3 w-3' : 'h-3 w-3'} mr-1 transform rotate-180`} />}
        <span>{Math.abs(Number(change))}%</span>
      </div>
    );
  };

  if (compact) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {/* Revenue Card */}
        <div className="bg-white p-3 rounded-md border shadow-sm">
          <div className="flex items-center mb-1">
            <CreditCard className="h-3 w-3 text-emerald-600 mr-1" />
            <h3 className="text-xs font-medium text-gray-600">Receita</h3>
          </div>
          <div className="flex justify-between items-end">
            <p className="text-sm font-bold">{formatCurrency(revenue)}</p>
            {renderChange(revenue, prevMonthRevenue)}
          </div>
        </div>

        {/* Forecasted Revenue Card */}
        <div className="bg-white p-3 rounded-md border shadow-sm">
          <div className="flex items-center mb-1">
            <Clock className="h-3 w-3 text-blue-600 mr-1" />
            <h3 className="text-xs font-medium text-gray-600">Previsto</h3>
          </div>
          <div className="flex justify-between items-end">
            <p className="text-sm font-bold">{formatCurrency(forecasted)}</p>
            {renderChange(forecasted, prevMonthForecasted)}
          </div>
        </div>

        {/* Outstanding Receivables Card */}
        <div className="bg-white p-3 rounded-md border shadow-sm">
          <div className="flex items-center mb-1">
            <Clock className="h-3 w-3 text-amber-600 mr-1" />
            <h3 className="text-xs font-medium text-gray-600">A Receber</h3>
          </div>
          <div className="flex justify-between items-end">
            <p className="text-sm font-bold">{formatCurrency(outstanding)}</p>
            {renderChange(outstanding, prevMonthOutstanding)}
          </div>
        </div>

        {/* Session Count Card */}
        <div className="bg-white p-3 rounded-md border shadow-sm">
          <div className="flex items-center mb-1">
            <CreditCard className="h-3 w-3 text-violet-600 mr-1" />
            <h3 className="text-xs font-medium text-gray-600">Sessões</h3>
          </div>
          <div className="flex justify-between items-end">
            <p className="text-sm font-bold">{sessionCount}</p>
            {renderChange(sessionCount, prevMonthSessionCount)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Revenue Card */}
      <div className="bg-white p-4 rounded-md border shadow-sm">
        <div className="flex items-center mb-2">
          <CreditCard className="h-4 w-4 text-emerald-600 mr-2" />
          <h3 className="text-sm font-medium text-gray-600">Receita</h3>
        </div>
        <div className="flex justify-between items-end">
          <p className="text-lg font-bold">{formatCurrency(revenue)}</p>
          {renderChange(revenue, prevMonthRevenue)}
        </div>
      </div>

      {/* Forecasted Revenue Card */}
      <div className="bg-white p-4 rounded-md border shadow-sm">
        <div className="flex items-center mb-2">
          <Clock className="h-4 w-4 text-blue-600 mr-2" />
          <h3 className="text-sm font-medium text-gray-600">Previsto</h3>
        </div>
        <div className="flex justify-between items-end">
          <p className="text-lg font-bold">{formatCurrency(forecasted)}</p>
          {renderChange(forecasted, prevMonthForecasted)}
        </div>
      </div>

      {/* Outstanding Receivables Card */}
      <div className="bg-white p-4 rounded-md border shadow-sm">
        <div className="flex items-center mb-2">
          <Clock className="h-4 w-4 text-amber-600 mr-2" />
          <h3 className="text-sm font-medium text-gray-600">A Receber</h3>
        </div>
        <div className="flex justify-between items-end">
          <p className="text-lg font-bold">{formatCurrency(outstanding)}</p>
          {renderChange(outstanding, prevMonthOutstanding)}
        </div>
      </div>

      {/* Session Count Card */}
      <div className="bg-white p-4 rounded-md border shadow-sm">
        <div className="flex items-center mb-2">
          <CreditCard className="h-4 w-4 text-violet-600 mr-2" />
          <h3 className="text-sm font-medium text-gray-600">Sessões</h3>
        </div>
        <div className="flex justify-between items-end">
          <p className="text-lg font-bold">{sessionCount}</p>
          {renderChange(sessionCount, prevMonthSessionCount)}
        </div>
      </div>
    </div>
  );
}
