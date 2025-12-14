import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Mail, Plus, Trash2, Loader2, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AllowedEmail {
  email: string;
  note: string | null;
  created_at: string;
  created_by: string | null;
}

export default function AllowedEmailsManager() {
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState<string | null>(null);

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('allowed_emails')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error('Error loading allowed emails:', error);
      toast.error('Erro ao carregar emails autorizados');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail.trim()) {
      toast.error('Digite um email válido');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast.error('Email inválido');
      return;
    }

    try {
      setSubmitting(true);
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('allowed_emails')
        .insert({
          email: newEmail.trim().toLowerCase(),
          note: newNote.trim() || null,
          created_by: userData.user?.id || null
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Este email já está autorizado');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Email autorizado com sucesso');
      setAddModalOpen(false);
      setNewEmail('');
      setNewNote('');
      loadEmails();
    } catch (error) {
      console.error('Error adding email:', error);
      toast.error('Erro ao adicionar email');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmail = async (email: string) => {
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('allowed_emails')
        .delete()
        .eq('email', email);

      if (error) throw error;

      toast.success('Email removido da lista de autorizados');
      setDeleteEmail(null);
      loadEmails();
    } catch (error) {
      console.error('Error deleting email:', error);
      toast.error('Erro ao remover email');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Emails Autorizados</CardTitle>
            <Badge variant="secondary" className="ml-2">{emails.length}</Badge>
          </div>
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Apenas emails nesta lista podem se cadastrar no sistema
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum email autorizado</p>
            <p className="text-xs">Adicione emails para permitir novos cadastros</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Observação</TableHead>
                <TableHead className="text-xs">Adicionado em</TableHead>
                <TableHead className="text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((item) => (
                <TableRow key={item.email} className="border-border/50">
                  <TableCell className="font-medium text-sm">{item.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.note || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteEmail(item.email)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add Email Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Autorizar Novo Email
            </DialogTitle>
            <DialogDescription>
              Este email terá acesso permanente e gratuito ao sistema, sem período de teste ou cobrança.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email *</label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observação (opcional)</label>
              <Textarea
                placeholder="Ex: Cliente indicado, parceiro comercial..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="bg-background resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleAddEmail} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Autorizar Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteEmail} onOpenChange={() => setDeleteEmail(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="h-5 w-5" />
              Remover Email Autorizado
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover <strong>{deleteEmail}</strong> da lista de emails autorizados?
              <br /><br />
              <span className="text-destructive font-medium">⚠️ Se o usuário já estiver cadastrado, ele perderá o acesso gratuito e precisará assinar um plano para continuar usando o sistema.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEmail(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteEmail && handleDeleteEmail(deleteEmail)} 
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
