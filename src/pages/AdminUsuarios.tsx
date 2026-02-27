import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Users, Crown, Search, Star, Clock, CheckCircle, XCircle, Loader2, Mail,
  TrendingUp, UserCheck, MoreVertical, Coins, HardDrive, CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AllowedEmailsManager from '@/components/admin/AllowedEmailsManager';
import { AdminStrategyTab } from '@/components/admin/AdminStrategyTab';
import { AdminSubscriptionsTab } from '@/components/admin/AdminSubscriptionsTab';
import { CreditsModal, StorageModal, SubscriptionsModal } from '@/components/admin/AdminUserActions';

interface UserWithData {
  id: string;
  email: string;
  nome: string | null;
  created_at: string;
  // Asaas subscription
  asaas_plan_type: string | null;
  asaas_status: string | null;
  asaas_billing_cycle: string | null;
  asaas_next_due_date: string | null;
  // Photographer account
  photo_credits: number;
  gallery_credits: number;
  free_transfer_bytes: number;
  // Legacy trial
  trial_status: string | null;
  trial_end: string | null;
  // Flags
  is_vip: boolean;
  is_admin: boolean;
  is_authorized: boolean;
}

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const { accessState, loading: accessLoading } = useAccessControl();
  const [users, setUsers] = useState<UserWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'trial' | 'active' | 'expired' | 'vip' | 'authorized'>('all');
  
  // VIP Modal
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithData | null>(null);
  const [vipReason, setVipReason] = useState('');
  const [vipAction, setVipAction] = useState<'add' | 'remove'>('add');
  const [submitting, setSubmitting] = useState(false);

  // Action modals
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [subsModalOpen, setSubsModalOpen] = useState(false);

  const [metrics, setMetrics] = useState({
    total: 0, trial: 0, active: 0, expired: 0, vip: 0, authorized: 0
  });

  useEffect(() => {
    if (!accessLoading && !accessState.isAdmin) {
      navigate('/app');
      toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
    }
  }, [accessState, accessLoading, navigate]);

  useEffect(() => {
    if (accessState.isAdmin) loadUsers();
  }, [accessState.isAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Parallel fetches
      const [profilesRes, asaasRes, accountsRes, trialRes, vipRes, rolesRes, allowedRes] = await Promise.all([
        supabase.from('profiles').select('id, user_id, email, nome, created_at').order('created_at', { ascending: false }),
        supabase.from('subscriptions_asaas').select('user_id, plan_type, status, billing_cycle, next_due_date').in('status', ['ACTIVE', 'PENDING', 'OVERDUE']),
        supabase.from('photographer_accounts').select('user_id, photo_credits, gallery_credits, free_transfer_bytes'),
        supabase.from('subscriptions').select('user_id, status, current_period_end').eq('status', 'trialing'),
        supabase.from('vip_users').select('user_id, reason, expires_at'),
        supabase.from('user_roles').select('user_id, role').eq('role', 'admin'),
        supabase.from('allowed_emails').select('email'),
      ]);

      const profiles = profilesRes.data || [];
      const asaasMap = new Map((asaasRes.data || []).map(s => [s.user_id, s]));
      const accountsMap = new Map((accountsRes.data || []).map(a => [a.user_id, a]));
      const trialMap = new Map((trialRes.data || []).map(t => [t.user_id, t]));
      const vipMap = new Map((vipRes.data || []).map(v => [v.user_id, v]));
      const adminSet = new Set((rolesRes.data || []).map(r => r.user_id));
      const authorizedSet = new Set((allowedRes.data || []).map(e => e.email.toLowerCase()));

      const combined: UserWithData[] = profiles.map(p => {
        const asaas = asaasMap.get(p.user_id);
        const account = accountsMap.get(p.user_id);
        const trial = trialMap.get(p.user_id);
        const vip = vipMap.get(p.user_id);

        return {
          id: p.user_id,
          email: p.email || '',
          nome: p.nome,
          created_at: p.created_at,
          asaas_plan_type: asaas?.plan_type || null,
          asaas_status: asaas?.status || null,
          asaas_billing_cycle: asaas?.billing_cycle || null,
          asaas_next_due_date: asaas?.next_due_date || null,
          photo_credits: account?.photo_credits ?? 0,
          gallery_credits: account?.gallery_credits ?? 0,
          free_transfer_bytes: account?.free_transfer_bytes ?? 0,
          trial_status: trial?.status || null,
          trial_end: trial?.current_period_end || null,
          is_vip: !!vip && (!vip.expires_at || new Date(vip.expires_at) > new Date()),
          is_admin: adminSet.has(p.user_id),
          is_authorized: authorizedSet.has((p.email || '').toLowerCase()),
        };
      });

      setUsers(combined);

      const now = new Date();
      setMetrics({
        total: combined.length,
        trial: combined.filter(u => !u.asaas_status && u.trial_status === 'trialing' && u.trial_end && new Date(u.trial_end) > now && !u.is_admin && !u.is_vip && !u.is_authorized).length,
        active: combined.filter(u => u.asaas_status === 'ACTIVE' && !u.is_admin).length,
        expired: combined.filter(u => !u.asaas_status && u.trial_status === 'trialing' && u.trial_end && new Date(u.trial_end) < now && !u.is_admin && !u.is_vip && !u.is_authorized).length,
        vip: combined.filter(u => u.is_vip && !u.is_admin).length,
        authorized: combined.filter(u => u.is_authorized && !u.is_admin).length,
      });
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleVipAction = (user: UserWithData, action: 'add' | 'remove') => {
    setSelectedUser(user);
    setVipAction(action);
    setVipReason('');
    setVipModalOpen(true);
  };

  const submitVipAction = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      if (vipAction === 'add') {
        const { error } = await supabase.from('vip_users').insert({
          user_id: selectedUser.id,
          reason: vipReason || 'Acesso VIP concedido pelo administrador',
          granted_by: (await supabase.auth.getUser()).data.user?.id
        });
        if (error) throw error;
        toast.success(`VIP concedido para ${selectedUser.nome || selectedUser.email}`);
      } else {
        const { error } = await supabase.from('vip_users').delete().eq('user_id', selectedUser.id);
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

  const getStatusBadge = (user: UserWithData) => {
    const badges = [];
    if (user.is_admin) badges.push(<Badge key="admin" className="bg-purple-500/20 text-purple-400 border-purple-500/30">Admin</Badge>);
    if (user.is_authorized) badges.push(<Badge key="auth" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Autorizado</Badge>);
    if (user.is_vip) badges.push(<Badge key="vip" className="bg-amber-500/20 text-amber-400 border-amber-500/30">VIP</Badge>);
    
    if (badges.length > 0) return <div className="flex gap-1 flex-wrap">{badges}</div>;
    
    if (user.asaas_status === 'ACTIVE') return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>;
    if (user.asaas_status === 'PENDING') return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pendente</Badge>;
    if (user.asaas_status === 'OVERDUE') return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Vencido</Badge>;
    
    if (user.trial_status === 'trialing') {
      const isExpired = user.trial_end && new Date(user.trial_end) < new Date();
      if (isExpired) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Trial Expirado</Badge>;
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Trial</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">Sem assinatura</Badge>;
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    return `${bytes} B`;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    if (!matchesSearch) return false;
    const now = new Date();
    switch (filter) {
      case 'trial': return !user.asaas_status && user.trial_status === 'trialing' && user.trial_end && new Date(user.trial_end) > now;
      case 'active': return !!user.asaas_status && user.asaas_status === 'ACTIVE';
      case 'expired': return !user.asaas_status && user.trial_status === 'trialing' && user.trial_end && new Date(user.trial_end) < now;
      case 'vip': return user.is_vip;
      case 'authorized': return user.is_authorized;
      default: return true;
    }
  });

  if (accessLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!accessState.isAdmin) return null;

  const userInfo = selectedUser ? { id: selectedUser.id, email: selectedUser.email, nome: selectedUser.nome } : null;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground">Gerenciamento de usuários, assinaturas e créditos</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-card/50 border border-border/50">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />Usuários
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />Assinaturas
          </TabsTrigger>
          <TabsTrigger value="strategy" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />Estratégia
          </TabsTrigger>
          <TabsTrigger value="emails" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />Emails Autorizados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div><p className="text-2xl font-bold">{metrics.total}</p><p className="text-xs text-muted-foreground">Total</p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <div><p className="text-2xl font-bold text-blue-400">{metrics.trial}</p><p className="text-xs text-muted-foreground">Em Trial</p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div><p className="text-2xl font-bold text-green-400">{metrics.active}</p><p className="text-xs text-muted-foreground">Ativos Asaas</p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-400" />
                  <div><p className="text-2xl font-bold text-red-400">{metrics.expired}</p><p className="text-xs text-muted-foreground">Expirados</p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-amber-400" />
                  <div><p className="text-2xl font-bold text-amber-400">{metrics.vip}</p><p className="text-xs text-muted-foreground">VIP</p></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-500/10 border-emerald-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <UserCheck className="h-5 w-5 text-emerald-400" />
                  <div><p className="text-2xl font-bold text-emerald-400">{metrics.authorized}</p><p className="text-xs text-muted-foreground">Autorizados</p></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filters */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nome ou email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-background" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'trial', 'active', 'expired', 'vip', 'authorized'] as const).map((f) => (
                    <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="text-xs">
                      {f === 'all' && 'Todos'}{f === 'trial' && 'Trial'}{f === 'active' && 'Ativos'}{f === 'expired' && 'Expirados'}{f === 'vip' && 'VIP'}{f === 'authorized' && 'Autorizados'}
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
                    <TableHead className="text-xs">Plano Asaas</TableHead>
                    <TableHead className="text-xs">Créditos</TableHead>
                    <TableHead className="text-xs">Storage</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell>
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
                          {user.asaas_plan_type ? (
                            <div>
                              <span className="font-medium">{user.asaas_plan_type}</span>
                              <span className="text-xs text-muted-foreground ml-1">
                                ({user.asaas_billing_cycle === 'MONTHLY' ? 'Mensal' : 'Anual'})
                              </span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="text-xs">
                            <span>{user.photo_credits} foto</span>
                            <span className="text-muted-foreground"> · </span>
                            <span>{user.gallery_credits} galeria</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatBytes(user.free_transfer_bytes)}
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedUser(user); setCreditsModalOpen(true); }}>
                                  <Coins className="h-4 w-4 mr-2" />Gerenciar Créditos
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedUser(user); setStorageModalOpen(true); }}>
                                  <HardDrive className="h-4 w-4 mr-2" />Ajustar Storage
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedUser(user); setSubsModalOpen(true); }}>
                                  <CreditCard className="h-4 w-4 mr-2" />Ver Assinaturas
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {user.is_vip ? (
                                  <DropdownMenuItem onClick={() => handleVipAction(user, 'remove')} className="text-amber-400">
                                    <Crown className="h-4 w-4 mr-2" />Remover VIP
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleVipAction(user, 'add')}>
                                    <Star className="h-4 w-4 mr-2" />Conceder VIP
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <AdminSubscriptionsTab />
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
              {vipAction === 'add' ? <><Star className="h-5 w-5 text-amber-400" />Conceder VIP</> : <><XCircle className="h-5 w-5 text-red-400" />Remover VIP</>}
            </DialogTitle>
            <DialogDescription>
              {vipAction === 'add' 
                ? `Conceder acesso VIP para ${selectedUser?.nome || selectedUser?.email}`
                : `Remover VIP de ${selectedUser?.nome || selectedUser?.email}`}
            </DialogDescription>
          </DialogHeader>
          {vipAction === 'add' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Textarea placeholder="Ex: Parceiro estratégico..." value={vipReason} onChange={(e) => setVipReason(e.target.value)} className="bg-background" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVipModalOpen(false)}>Cancelar</Button>
            <Button onClick={submitVipAction} disabled={submitting} variant={vipAction === 'remove' ? 'destructive' : 'default'}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {vipAction === 'add' ? 'Conceder VIP' : 'Remover VIP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Modals */}
      <CreditsModal open={creditsModalOpen} onOpenChange={setCreditsModalOpen} user={userInfo} onSuccess={loadUsers} />
      <StorageModal open={storageModalOpen} onOpenChange={setStorageModalOpen} user={userInfo} onSuccess={loadUsers} />
      <SubscriptionsModal open={subsModalOpen} onOpenChange={setSubsModalOpen} user={userInfo} onSuccess={loadUsers} />
    </div>
  );
}
