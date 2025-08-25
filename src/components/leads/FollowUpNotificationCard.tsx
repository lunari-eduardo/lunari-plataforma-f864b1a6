import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Eye, X } from 'lucide-react';
import { useFollowUpSystem } from '@/hooks/useFollowUpSystem';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FollowUpNotificationCard() {
  const { 
    getUnviewedNotifications, 
    getLeadsNeedingFollowUp, 
    markNotificationAsViewed,
    dismissFollowUp 
  } = useFollowUpSystem();

  const unviewedNotifications = getUnviewedNotifications();
  const leadsNeedingFollowUp = getLeadsNeedingFollowUp();

  if (unviewedNotifications.length === 0 && leadsNeedingFollowUp.length === 0) {
    return null;
  }

  return (
    <Card className="bg-red-50 border-red-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-red-900">
          <Clock className="h-5 w-5" />
          Follow-ups Pendentes
          <Badge variant="destructive" className="ml-auto">
            {leadsNeedingFollowUp.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {leadsNeedingFollowUp.slice(0, 3).map((lead) => {
          const notification = unviewedNotifications.find(n => n.leadId === lead.id);
          
          return (
            <div 
              key={lead.id}
              className="flex items-center justify-between p-3 bg-white rounded-md border border-red-200"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-red-900 truncate">
                  {lead.nome}
                </p>
                <p className="text-sm text-red-700">
                  {lead.diasSemInteracao} dias sem interação
                </p>
                {notification && (
                  <p className="text-xs text-red-600">
                    {formatDistanceToNowStrict(new Date(notification.timestamp), {
                      addSuffix: true,
                      locale: ptBR
                    })}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1">
                {notification && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => markNotificationAsViewed(notification.id)}
                    title="Marcar como visualizada"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => dismissFollowUp(lead.id)}
                  title="Dispensar follow-up"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {leadsNeedingFollowUp.length > 3 && (
          <div className="text-sm text-red-700 text-center">
            +{leadsNeedingFollowUp.length - 3} leads precisam de follow-up
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Link to="/orcamentos?tab=leads" className="flex-1">
            <Button variant="outline" className="w-full">
              Ver Todos os Leads
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}