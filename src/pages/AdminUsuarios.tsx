import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Users, 
  Crown, 
  Search, 
  Shield, 
  Star, 
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Mail,
  TrendingUp,
  UserCheck,
  Images
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AllowedEmailsManager from '@/components/admin/AllowedEmailsManager';
import { AdminStrategyTab } from '@/components/admin/AdminStrategyTab';

interface UserWithSubscription {
  id: string;
  email: string;
  nome: string | null;
  created_at: string;
  subscription_status: string | null;
  plan_code: string | null;
  plan_name: string | null;
  current_period_end: string | null;
  is_vip: boolean;
  is_admin: boolean;
  is_authorized: boolean;
  has_galery: boolean;
}

interface VipUser {
  user_id: string;
  reason: string | null;
  expires_at: string | null;
}

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const { accessState, loading: accessLoading } = useAccessControl();
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'trial' | 'active' | 'expired' | 'vip' | 'authorized'>('all');
  
  // VIP Modal state
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithSubscription | null>(null);
  const [vipReason, setVipReason] = useState('');
  const [vipAction, setVipAction] = useState<'add' | 'remove'>('add');
  const [submitting, setSubmitting] = useState(false);
  
  // Galery Plan Modal state
  const [galeryModalOpen, setGaleryModalOpen] = useState(false);
  const [galeryAction, setGaleryAction] = useState<'add' | 'remove'>('add');

  // Metrics
  const [metrics, setMetrics] = useState({
    total: 0,
    trial: 0,
    active: 0,
    expired: 0,
    vip: 0,
    authorized: 0
  });

  useEffect(() => {
    if (!accessLoading && !accessState.isAdmin) {
      navigate('/app');
      toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
    }
  }, [accessState, accessLoading, navigate]);

  useEffect(() => {
    if (accessState.isAdmin) {
      loadUsers();
    }
  }, [accessState.isAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles with subscriptions
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          email,
          nome,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all subscriptions
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select(`
          user_id,
          status,
          current_period_end,
          plan_id,
          plans (
            code,
            name
          )
        `);

      if (subsError) throw subsError;

      // Fetch VIP users
      const { data: vipUsers, error: vipError } = await supabase
        .from('vip_users')
        .select('user_id, reason, expires_at');

      if (vipError) throw vipError;

      // Fetch admin roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      // Fetch authorized emails
      const { data: allowedEmails, error: allowedError } = await supabase
        .from('allowed_emails')
        .select('email');

      if (allowedError) throw allowedError;

      // Create lookup maps
      const subsMap = new Map(subscriptions?.map(s => [s.user_id, s]) || []);
      const vipMap = new Map(vipUsers?.map(v => [v.user_id, v]) || []);
      const adminSet = new Set(adminRoles?.map(r => r.user_id) || []);
      const authorizedEmailsSet = new Set(allowedEmails?.map(e => e.email.toLowerCase()) || []);

      // Combine data
      const combinedUsers: UserWithSubscription[] = (profiles || []).map(profile => {
        const sub = subsMap.get(profile.user_id);
        const vip = vipMap.get(profile.user_id);
        const isAdmin = adminSet.has(profile.user_id);
        const isAuthorized = authorizedEmailsSet.has((profile.email || '').toLowerCase());

        return {
          id: profile.user_id,
          email: profile.email || '',
          nome: profile.nome,
          created_at: profile.created_at,
          subscription_status: sub?.status || null,
          plan_code: (sub?.plans as any)?.code || null,
          plan_name: (sub?.plans as any)?.name || null,
          current_period_end: sub?.current_period_end || null,
          is_vip: !!vip && (!vip.expires_at || new Date(vip.expires_at) > new Date()),
          is_admin: isAdmin,
          is_authorized: isAuthorized,
          has_galery: ((sub?.plans as any)?.code || '').startsWith('pro_galery')
        };
      });

      setUsers(combinedUsers);

      // Calculate metrics
      const now = new Date();
      
      // Contar usuários em trial ativo (não expirado)
      const trialUsers = combinedUsers.filter(u => 
        u.subscription_status === 'trialing' && 
        (!u.current_period_end || new Date(u.current_period_end) > now) &&
        !u.is_admin && !u.is_vip && !u.is_authorized
      );
      
      // Contar usuários com assinatura ativa (paga)
      const activeUsers = combinedUsers.filter(u => 
        u.subscription_status === 'active' &&
        !u.is_admin && !u.is_vip && !u.is_authorized
      );
      
      // Contar usuários com trial expirado (sem outra forma de acesso)
      const expiredUsers = combinedUsers.filter(u => 
        u.subscription_status === 'trialing' && 
        u.current_period_end && 
        new Date(u.current_period_end) < now &&
        !u.is_admin && !u.is_vip && !u.is_authorized
      );
      
      // VIP ativos
      const activeVipUsers = combinedUsers.filter(u => u.is_vip && !u.is_admin);
      
      // Autorizados (emails na lista)
      const authorizedUsersCount = combinedUsers.filter(u => u.is_authorized && !u.is_admin);
      
      setMetrics({
        total: combinedUsers.length,
        trial: trialUsers.length,
        active: activeUsers.length,
        expired: expiredUsers.length,
        vip: activeVipUsers.length,
        authorized: authorizedUsersCount.length
      });

    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleVipAction = (user: UserWithSubscription, action: 'add' | 'remove') => {
    setSelectedUser(user);
    setVipAction(action);
    setVipReason('');
    setVipModalOpen(true);
  };

  const handleGaleryAction = (user: UserWithSubscription, action: 'add' | 'remove') => {
    setSelectedUser(user);
    setGaleryAction(action);
    setGaleryModalOpen(true);
  };

  const submitGaleryAction = async () => {
    if (!selectedUser) return;

    try {
      setSubmitting(true);

      // Buscar o plano pro_galery_monthly
      const { data: galeryPlan, error: planError } = await supabase
        .from('plans')
        .select('id')
        .eq('code', 'pro_galery_monthly')
        .single();

      if (planError || !galeryPlan) {
        toast.error('Plano Pro + Galery não encontrado');
        return;
      }

      if (galeryAction === 'add') {
        // Verificar se já existe subscription
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', selectedUser.id)
          .single();

        if (existingSub) {
          // Atualizar subscription existente
          const { error } = await supabase
            .from('subscriptions')
            .update({
              plan_id: galeryPlan.id,
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', selectedUser.id);

          if (error) throw error;
        } else {
          // Criar nova subscription
          const { error } = await supabase
            .from('subscriptions')
            .insert({
              user_id: selectedUser.id,
              plan_id: galeryPlan.id,
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: null // Sem expiração para atribuição manual
            });

          if (error) throw error;
        }

        toast.success(`Pro + Galery atribuído para ${selectedUser.nome || selectedUser.email}`);
      } else {
        // Remover = voltar para pro_monthly
        const { data: proPlan } = await supabase
          .from('plans')
          .select('id')
          .eq('code', 'pro_monthly')
          .single();

        if (proPlan) {
          const { error } = await supabase
            .from('subscriptions')
            .update({
              plan_id: proPlan.id,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', selectedUser.id);

          if (error) throw error;
          toast.success(`Pro + Galery removido de ${selectedUser.nome || selectedUser.email}`);
        }
      }

      setGaleryModalOpen(false);
      loadUsers();
    } catch (error) {
      console.error('Error managing Galery plan:', error);
      toast.error('Erro ao gerenciar plano Pro + Galery');
    } finally {
      setSubmitting(false);
    }
  };

  const submitVipAction = async () => {
    if (!selectedUser) return;

    try {
      setSubmitting(true);

      if (vipAction === 'add') {
        const { error } = await supabase
          .from('vip_users')
          .insert({
            user_id: selectedUser.id,
            reason: vipReason || 'Acesso VIP concedido pelo administrador',
            granted_by: (await supabase.auth.getUser()).data.user?.id
          });

        if (error) throw error;
        toast.success(`VIP concedido para ${selectedUser.nome || selectedUser.email}`);
      } else {
        const { error } = await supabase
          .from('vip_users')
          .delete()
          .eq('user_id', selectedUser.id);

        if (error) throw error;
        toast.success(`VIP removido de ${selectedUser.nome || selectedUser.email}`);
      }

      setVipModalOpen(false);
      loadUsers();
    } catch (error) {
      console.error('Error managing VIP:', error);
      toast.error('Erro ao gerenciar VIP');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (user: UserWithSubscription) => {
    const badges = [];
    
    if (user.is_admin) {
      badges.push(<Badge key="admin" className="bg-purple-500/20 text-purple-400 border-purple-500/30">Admin</Badge>);
    }
    if (user.is_authorized) {
      badges.push(<Badge key="auth" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Autorizado</Badge>);
    }
    if (user.is_vip) {
      badges.push(<Badge key="vip" className="bg-amber-500/20 text-amber-400 border-amber-500/30">VIP</Badge>);
    }
    if (user.has_galery) {
      badges.push(<Badge key="galery" className="bg-pink-500/20 text-pink-400 border-pink-500/30"><Images className="h-3 w-3 mr-1" />Galery</Badge>);
    }
    
    if (badges.length > 0) {
      return <div className="flex gap-1 flex-wrap">{badges}</div>;
    }
    
    if (user.subscription_status === 'active') {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>;
    }
    if (user.subscription_status === 'trialing') {
      const isExpired = user.current_period_end && new Date(user.current_period_end) < new Date();
      if (isExpired) {
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Trial Expirado</Badge>;
      }
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Trial</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">Sem assinatura</Badge>;
  };

  const filteredUsers = users.filter(user => {
    // Search filter
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    if (!matchesSearch) return false;

    // Status filter
    const now = new Date();
    switch (filter) {
      case 'trial':
        return user.subscription_status === 'trialing' && 
          user.current_period_end && 
          new Date(user.current_period_end) > now;
      case 'active':
        return user.subscription_status === 'active';
      case 'expired':
        return user.subscription_status === 'trialing' && 
          user.current_period_end && 
          new Date(user.current_period_end) < now;
      case 'vip':
        return user.is_vip;
      case 'authorized':
        return user.is_authorized;
      default:
        return true;
    }
  });

  if (accessLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!accessState.isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground">Gerenciamento de usuários e assinaturas</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-card/50 border border-border/50">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="strategy" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Estratégia
          </TabsTrigger>
          <TabsTrigger value="emails" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Emails Autorizados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{metrics.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-2xl font-bold text-blue-400">{metrics.trial}</p>
                    <p className="text-xs text-muted-foreground">Em Trial</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="text-2xl font-bold text-green-400">{metrics.active}</p>
                    <p className="text-xs text-muted-foreground">Ativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-400" />
                  <div>
                    <p className="text-2xl font-bold text-red-400">{metrics.expired}</p>
                    <p className="text-xs text-muted-foreground">Expirados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-amber-500/10 border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-amber-400" />
                  <div>
                    <p className="text-2xl font-bold text-amber-400">{metrics.vip}</p>
                    <p className="text-xs text-muted-foreground">VIP</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-emerald-500/10 border-emerald-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <UserCheck className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-2xl font-bold text-emerald-400">{metrics.authorized}</p>
                    <p className="text-xs text-muted-foreground">Autorizados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-background"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'trial', 'active', 'expired', 'vip', 'authorized'] as const).map((f) => (
                    <Button
                      key={f}
                      variant={filter === f ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter(f)}
                      className="text-xs"
                    >
                      {f === 'all' && 'Todos'}
                      {f === 'trial' && 'Trial'}
                      {f === 'active' && 'Ativos'}
                      {f === 'expired' && 'Expirados'}
                      {f === 'vip' && 'VIP'}
                      {f === 'authorized' && 'Autorizados'}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="text-xs">Usuário</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Plano</TableHead>
                    <TableHead className="text-xs">Expira em</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-border/50">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{user.nome || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(user)}</TableCell>
                        <TableCell className="text-sm">
                          {user.plan_name || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.current_period_end 
                            ? format(new Date(user.current_period_end), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!user.is_admin && (
                              <>
                                {/* VIP Actions */}
                                {user.is_vip ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleVipAction(user, 'remove')}
                                    className="text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                                  >
                                    <Crown className="h-3 w-3 mr-1" />
                                    VIP
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleVipAction(user, 'add')}
                                    className="text-xs"
                                  >
                                    <Star className="h-3 w-3 mr-1" />
                                    VIP
                                  </Button>
                                )}
                                
                                {/* Galery Actions */}
                                {user.has_galery ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleGaleryAction(user, 'remove')}
                                    className="text-xs text-pink-400 border-pink-500/30 hover:bg-pink-500/10"
                                  >
                                    <Images className="h-3 w-3 mr-1" />
                                    Galery
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleGaleryAction(user, 'add')}
                                    className="text-xs"
                                  >
                                    <Images className="h-3 w-3 mr-1" />
                                    Galery
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategy">
          <AdminStrategyTab />
        </TabsContent>

        <TabsContent value="emails">
          <AllowedEmailsManager />
        </TabsContent>
      </Tabs>

      {/* VIP Modal */}
      <Dialog open={vipModalOpen} onOpenChange={setVipModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {vipAction === 'add' ? (
                <>
                  <Star className="h-5 w-5 text-amber-400" />
                  Conceder Acesso VIP
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-400" />
                  Remover Acesso VIP
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {vipAction === 'add' 
                ? `Conceder acesso VIP ilimitado para ${selectedUser?.nome || selectedUser?.email}`
                : `Remover acesso VIP de ${selectedUser?.nome || selectedUser?.email}`
              }
            </DialogDescription>
          </DialogHeader>
          
          {vipAction === 'add' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Textarea
                placeholder="Ex: Parceiro estratégico, Beta tester..."
                value={vipReason}
                onChange={(e) => setVipReason(e.target.value)}
                className="bg-background"
              />
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setVipModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={submitVipAction}
              disabled={submitting}
              variant={vipAction === 'remove' ? 'destructive' : 'default'}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {vipAction === 'add' ? 'Conceder VIP' : 'Remover VIP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Galery Plan Modal */}
      <Dialog open={galeryModalOpen} onOpenChange={setGaleryModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {galeryAction === 'add' ? (
                <>
                  <Images className="h-5 w-5 text-pink-400" />
                  Atribuir Pro + Galery
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-400" />
                  Remover Pro + Galery
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {galeryAction === 'add' 
                ? `Atribuir plano Pro + Galery para ${selectedUser?.nome || selectedUser?.email}. Este plano dá acesso às funcionalidades de Galeria.`
                : `Remover plano Pro + Galery de ${selectedUser?.nome || selectedUser?.email}. O usuário voltará ao plano Pro padrão.`
              }
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setGaleryModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={submitGaleryAction}
              disabled={submitting}
              variant={galeryAction === 'remove' ? 'destructive' : 'default'}
              className={galeryAction === 'add' ? 'bg-pink-600 hover:bg-pink-700' : ''}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {galeryAction === 'add' ? 'Atribuir Pro + Galery' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
