import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { toTitleCase } from '@/hooks/useTitleCase';
import { User, Mail, Phone, MapPin, Users, FileText, Loader2, AlertCircle } from 'lucide-react';

const ORIGENS_PADRAO = [
  { id: 'instagram', nome: 'Instagram', cor: '#E1306C' },
  { id: 'facebook', nome: 'Facebook', cor: '#1877F2' },
  { id: 'google', nome: 'Google', cor: '#4285F4' },
  { id: 'indicacao', nome: 'Indicação', cor: '#10B981' },
  { id: 'site', nome: 'Site', cor: '#6366F1' },
  { id: 'outro', nome: 'Outro', cor: '#6B7280' }
];

interface ClientEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome?: string;
  onSuccess?: (novoNome?: string) => void;
}

export function ClientEditModal({ 
  open, 
  onOpenChange, 
  clienteId, 
  clienteNome,
  onSuccess 
}: ClientEditModalProps) {
  const { getClienteById, getClienteByNome, atualizarCliente, isLoading: clientesLoading } = useClientesRealtime();
  const [isSaving, setIsSaving] = useState(false);
  const [resolvedClienteId, setResolvedClienteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    endereco: '',
    origem: '',
    observacoes: ''
  });

  // Carregar dados do cliente quando o modal abre
  // Se clienteId vazio mas clienteNome existe, buscar por nome
  useEffect(() => {
    if (open) {
      let foundCliente = null;
      let foundClienteId: string | null = null;
      
      if (clienteId) {
        foundCliente = getClienteById(clienteId);
        foundClienteId = clienteId;
      } else if (clienteNome) {
        // Buscar cliente por nome quando clienteId não está vinculado
        foundCliente = getClienteByNome(clienteNome);
        foundClienteId = foundCliente?.id || null;
      }
      
      setResolvedClienteId(foundClienteId);
      
      if (foundCliente) {
        setFormData({
          nome: foundCliente.nome || '',
          email: foundCliente.email || '',
          telefone: foundCliente.telefone || '',
          endereco: foundCliente.endereco || '',
          origem: foundCliente.origem || '',
          observacoes: foundCliente.observacoes || ''
        });
      }
    }
  }, [open, clienteId, clienteNome, getClienteById, getClienteByNome]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // onChange: mantém texto como digitado (preserva posição do cursor)
  const handleNomeChange = (value: string) => {
    setFormData(prev => ({ ...prev, nome: value }));
  };

  // onBlur: aplica Title Case apenas quando sai do campo
  const handleNomeBlur = () => {
    const formatted = toTitleCase(formData.nome);
    setFormData(prev => ({ ...prev, nome: formatted }));
  };

  const validateEmail = (email: string) => {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    if (!phone) return true;
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
  };

  const handleSave = async () => {
    // Validação
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (formData.email && !validateEmail(formData.email)) {
      toast.error('Email inválido');
      return;
    }

    if (formData.telefone && !validatePhone(formData.telefone)) {
      toast.error('Telefone deve ter 10 ou 11 dígitos');
      return;
    }

    setIsSaving(true);
    try {
      const clienteIdToUpdate = resolvedClienteId || clienteId;
      if (!clienteIdToUpdate) {
        toast.error('Cliente não encontrado');
        return;
      }
      
      await atualizarCliente(clienteIdToUpdate, {
        nome: formData.nome.trim(),
        email: formData.email.trim() || undefined,
        telefone: formData.telefone.trim() || undefined,
        endereco: formData.endereco.trim() || undefined,
        origem: formData.origem || undefined,
        observacoes: formData.observacoes.trim() || undefined
      });
      
      toast.success('Cliente atualizado com sucesso');
      // Passa o novo nome no callback
      onSuccess?.(formData.nome.trim());
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      toast.error('Erro ao atualizar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  const getOriginDisplayName = (origemId: string) => {
    const origem = ORIGENS_PADRAO.find(o => o.id === origemId);
    return origem?.nome || origemId;
  };

  // Cliente não encontrado - usa resolvedClienteId que inclui busca por nome
  const clienteNotFound = !resolvedClienteId && !clientesLoading && open;

  // Sem cliente vinculado (nem por ID nem por nome)
  if (clienteNotFound && !clienteNome) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-lunar-warning" />
              Cliente não vinculado
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center text-lunar-muted">
            <p>Este agendamento não possui um cliente vinculado.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Cliente não encontrado no banco (nem por ID nem por nome)
  if (clienteNotFound && clienteNome) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-lunar-error" />
              Cliente não encontrado
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center text-lunar-muted">
            <p>O cliente "<strong>{clienteNome}</strong>" não foi encontrado no CRM.</p>
            <p className="mt-2 text-sm">Verifique se o nome está correto ou cadastre o cliente primeiro.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-lunar-accent" />
            Editar Cliente
          </DialogTitle>
        </DialogHeader>

        {clientesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-lunar-muted" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="nome" className="flex items-center gap-2 text-sm">
                <User className="h-3 w-3" />
                Nome *
              </Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={e => handleNomeChange(e.target.value)}
                onBlur={handleNomeBlur}
                placeholder="Nome completo do cliente"
                className="focus:ring-2 focus:ring-lunar-primary/20"
              />
            </div>

            {/* Email e Telefone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-sm">
                  <Mail className="h-3 w-3" />
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                  placeholder="cliente@email.com"
                  className={`focus:ring-2 focus:ring-lunar-primary/20 ${
                    formData.email && !validateEmail(formData.email) 
                      ? 'border-destructive focus:border-destructive' 
                      : ''
                  }`}
                />
                {formData.email && !validateEmail(formData.email) && (
                  <p className="text-xs text-destructive">Formato de e-mail inválido</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone" className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3" />
                  Telefone
                </Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={e => handleChange('telefone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  className={`focus:ring-2 focus:ring-lunar-primary/20 ${
                    formData.telefone && !validatePhone(formData.telefone)
                      ? 'border-destructive focus:border-destructive'
                      : ''
                  }`}
                />
                {formData.telefone && !validatePhone(formData.telefone) && (
                  <p className="text-xs text-destructive">Telefone deve ter 10 ou 11 dígitos</p>
                )}
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-2">
              <Label htmlFor="endereco" className="flex items-center gap-2 text-sm">
                <MapPin className="h-3 w-3" />
                Endereço
              </Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={e => handleChange('endereco', e.target.value)}
                placeholder="Rua, número, bairro, cidade"
                className="focus:ring-2 focus:ring-lunar-primary/20"
              />
            </div>

            {/* Origem */}
            <div className="space-y-2">
              <Label htmlFor="origem" className="flex items-center gap-2 text-sm">
                <Users className="h-3 w-3" />
                Como conheceu?
              </Label>
              <Select value={formData.origem} onValueChange={(value) => handleChange('origem', value)}>
                <SelectTrigger className="focus:ring-2 focus:ring-lunar-primary/20">
                  <SelectValue placeholder="Selecione uma origem" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {ORIGENS_PADRAO.map(origem => (
                    <SelectItem key={origem.id} value={origem.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: origem.cor }} />
                        {origem.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="observacoes" className="flex items-center gap-2 text-sm">
                <FileText className="h-3 w-3" />
                Observações
              </Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={e => handleChange('observacoes', e.target.value)}
                placeholder="Anotações sobre o cliente..."
                className="min-h-[80px] resize-none focus:ring-2 focus:ring-lunar-primary/20"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || clientesLoading}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
