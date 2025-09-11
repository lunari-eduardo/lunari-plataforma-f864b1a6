import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, CreditCard, Edit, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChangeLogEntry {
  id: string;
  tipo: 'sessao' | 'pagamento';
  acao: 'criacao' | 'edicao' | 'pagamento';
  timestamp: string;
  descricao: string;
  valor?: number;
  usuario?: string;
}

interface SessionChangeLogProps {
  sessionId: string;
  clienteId: string;
}

export function SessionChangeLog({ sessionId, clienteId }: SessionChangeLogProps) {
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChangeLog = async () => {
      try {
        setLoading(true);
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) return;

        // Buscar mudanças na sessão
        const { data: sessionChanges } = await supabase
          .from('clientes_sessoes')
          .select('created_at, updated_at, updated_by')
          .eq('session_id', sessionId)
          .eq('user_id', user.user.id)
          .single();

        // Buscar pagamentos da sessão
        const { data: payments } = await supabase
          .from('clientes_transacoes')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', user.user.id)
          .order('created_at', { ascending: false });

        const entries: ChangeLogEntry[] = [];

        // Adicionar entrada de criação da sessão
        if (sessionChanges?.created_at) {
          entries.push({
            id: `session-created-${sessionId}`,
            tipo: 'sessao',
            acao: 'criacao',
            timestamp: sessionChanges.created_at,
            descricao: 'Sessão criada',
            usuario: sessionChanges.updated_by
          });
        }

        // Adicionar entrada de edição se diferente da criação
        if (sessionChanges?.updated_at && 
            sessionChanges.updated_at !== sessionChanges.created_at) {
          entries.push({
            id: `session-updated-${sessionId}`,
            tipo: 'sessao',
            acao: 'edicao',
            timestamp: sessionChanges.updated_at,
            descricao: 'Sessão atualizada',
            usuario: sessionChanges.updated_by
          });
        }

        // Adicionar pagamentos
        payments?.forEach(payment => {
          entries.push({
            id: `payment-${payment.id}`,
            tipo: 'pagamento',
            acao: 'pagamento',
            timestamp: payment.created_at || payment.data_transacao,
            descricao: payment.descricao || `Pagamento de R$ ${payment.valor.toFixed(2)}`,
            valor: payment.valor,
            usuario: payment.updated_by
          });
        });

        // Ordenar por timestamp desc
        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setChangeLog(entries);
      } catch (error) {
        console.error('Error loading change log:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChangeLog();
  }, [sessionId, clienteId]);

  const getIcon = (entry: ChangeLogEntry) => {
    if (entry.tipo === 'pagamento') return <CreditCard className="h-4 w-4" />;
    if (entry.acao === 'criacao') return <Plus className="h-4 w-4" />;
    return <Edit className="h-4 w-4" />;
  };

  const getActionColor = (entry: ChangeLogEntry) => {
    if (entry.tipo === 'pagamento') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (entry.acao === 'criacao') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Alterações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Alterações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {changeLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma alteração registrada
              </p>
            ) : (
              changeLog.map((entry) => (
                <div 
                  key={entry.id}
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  <div className={`p-1 rounded-full ${getActionColor(entry)}`}>
                    {getIcon(entry)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {entry.descricao}
                      </span>
                      {entry.valor && (
                        <Badge variant="outline" className="text-xs">
                          R$ {entry.valor.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(entry.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    
                    {entry.usuario && (
                      <div className="text-xs text-muted-foreground mt-1">
                        por {entry.usuario}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}