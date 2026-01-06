import { TrendingDown, DollarSign, CheckCircle2, Calendar, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinancialDashboardData } from "@/hooks/useFinancialDashboardData";
import { toast } from "sonner";

export function FinancialRemindersCard() {
  const {
    upcomingAccounts,
    overdueAccounts,
    todayBilledSummary,
    markAsPaidQuick,
    formatCurrency,
    formatDate,
    getUrgencyColor,
    getUrgencyBgColor,
    getOverdueDaysLabel
  } = useFinancialDashboardData();

  const handleMarkAsPaid = async (transactionId: string, itemName: string) => {
    const success = await markAsPaidQuick(transactionId);
    if (success) {
      toast.success(`${itemName} marcado como pago`);
    } else {
      toast.error('Erro ao marcar como pago');
    }
  };

  const getTotalUpcoming = () => {
    return upcomingAccounts.reduce((sum, account) => sum + account.amount, 0);
  };

  const getTotalOverdue = () => {
    return overdueAccounts.reduce((sum, account) => sum + account.amount, 0);
  };

  const totalItems = upcomingAccounts.length + todayBilledSummary.count + overdueAccounts.length;

  return (
    <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-gradient">
            <TrendingDown className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="font-semibold text-base">Contas a Pagar</CardTitle>
        </div>
        {totalItems > 0 && (
          <Badge variant="outline" className="text-2xs">
            {totalItems} itens
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overdue Accounts */}
        {overdueAccounts.length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h4 className="font-semibold text-sm text-destructive">Contas Atrasadas</h4>
              </div>
              <Badge variant="destructive" className="text-2xs">
                {overdueAccounts.length} conta{overdueAccounts.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-bold text-destructive">
                {formatCurrency(getTotalOverdue())}
              </span>
            </div>

            <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-elegant">
              {overdueAccounts.map(account => (
                <div key={account.id} className="flex items-center justify-between text-2xs bg-destructive/5 rounded p-2 border border-destructive/20">
                  <div className="flex-1 min-w-0 mr-2">
                    <span className="font-medium truncate block text-destructive">
                      {account.itemName}
                    </span>
                    <span className="text-destructive/80 text-[10px]">
                      {getOverdueDaysLabel(account.daysUntilDue)} • {formatDate(account.dueDate)}
                    </span>
                  </div>
                  <span className="font-bold mr-2 text-destructive whitespace-nowrap">
                    {formatCurrency(account.amount)}
                  </span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 px-2 text-2xs border-destructive/30 text-destructive hover:bg-destructive/10" 
                    onClick={() => handleMarkAsPaid(account.id, account.itemName)}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Billed Summary */}
        {todayBilledSummary.count > 0 && (
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-destructive" />
                <h4 className="font-medium text-sm text-destructive">Faturadas Hoje</h4>
              </div>
              <Badge variant="destructive" className="text-2xs">
                {todayBilledSummary.count} conta{todayBilledSummary.count !== 1 ? 's' : ''}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-destructive">
                {formatCurrency(todayBilledSummary.totalAmount)}
              </span>
              {todayBilledSummary.transactions.length === 1 && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-2xs border-destructive/30 text-destructive hover:bg-destructive/10" 
                  onClick={() => handleMarkAsPaid(todayBilledSummary.transactions[0].id, todayBilledSummary.transactions[0].itemName)}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Pago
                </Button>
              )}
            </div>

            {/* Individual items if multiple */}
            {todayBilledSummary.transactions.length > 1 && (
              <div className="mt-3 space-y-2 max-h-32 overflow-y-auto scrollbar-elegant">
                {todayBilledSummary.transactions.map(transaction => (
                  <div key={transaction.id} className="flex items-center justify-between text-2xs bg-lunar-surface/50 rounded p-2">
                    <span className="font-medium truncate flex-1 mr-2">
                      {transaction.itemName}
                    </span>
                    <span className="font-medium mr-2 text-destructive">
                      {formatCurrency(transaction.amount)}
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-6 px-2 text-2xs border-destructive/30 text-destructive hover:bg-destructive/10" 
                      onClick={() => handleMarkAsPaid(transaction.id, transaction.itemName)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upcoming Accounts (Next 3 Days) */}
        {upcomingAccounts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-sm">Próximos 3 Dias</h4>
              </div>
              <span className="text-2xs text-lunar-textSecondary font-medium">
                Total: {formatCurrency(getTotalUpcoming())}
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-elegant">
              {upcomingAccounts.map(account => (
                <div 
                  key={account.id} 
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${getUrgencyBgColor(account.urgency)}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {account.itemName}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-2xs px-1.5 py-0 ${getUrgencyColor(account.urgency)} border-current`}
                      >
                        {account.urgency === 'today' ? 'Hoje' : 
                         account.urgency === 'tomorrow' ? 'Amanhã' : 
                         `${account.daysUntilDue}d`}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3 text-2xs text-lunar-textSecondary">
                      <span className={`font-semibold ${getUrgencyColor(account.urgency)}`}>
                        {formatCurrency(account.amount)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(account.dueDate)}</span>
                      </div>
                      <Badge variant="outline" className="text-2xs px-1 py-0">
                        {account.status}
                      </Badge>
                    </div>
                  </div>

                  {account.status === 'Faturado' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 px-2 text-2xs ml-2" 
                      onClick={() => handleMarkAsPaid(account.id, account.itemName)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {upcomingAccounts.length === 0 && todayBilledSummary.count === 0 && overdueAccounts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-lunar-success mb-3" />
            <p className="text-sm font-medium text-lunar-textSecondary">
              Nenhuma conta a pagar pendente
            </p>
            <p className="text-2xs text-lunar-textSecondary mt-1">
              Suas finanças estão em dia
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
