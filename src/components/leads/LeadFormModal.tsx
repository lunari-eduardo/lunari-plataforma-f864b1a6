import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import type { Lead } from '@/types/leads';

interface LeadFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial?: Lead;
  onSubmit: (data: Omit<Lead, 'id' | 'dataCriacao'>) => void;
}

export default function LeadFormModal({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit
}: LeadFormModalProps) {
  const { origens, clientes } = useAppContext();
  const { statuses, getDefaultOpenKey } = useLeadStatuses();
  
  const getInitialFormData = () => ({
    nome: '',
    email: '',
    telefone: '',
    origem: '',
    status: getDefaultOpenKey() || 'novo_contato',
    observacoes: '',
    clienteId: ''
  });

  const [formData, setFormData] = useState(getInitialFormData);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initial) {
        setFormData({
          nome: initial.nome,
          email: initial.email,
          telefone: initial.telefone,
          origem: initial.origem || '',
          status: initial.status,
          observacoes: initial.observacoes || '',
          clienteId: initial.clienteId || ''
        });
      } else {
        setFormData(getInitialFormData());
      }
      setErrors({});
    }
  }, [open, mode, initial]);

  const handleClose = (open: boolean) => {
    if (!open) {
      setFormData(getInitialFormData());
      setErrors({});
    }
    onOpenChange(open);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.telefone.trim()) {
      newErrors.telefone = 'Telefone é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    onSubmit({
      nome: formData.nome.trim(),
      email: formData.email.trim(),
      telefone: formData.telefone.trim(),
      origem: formData.origem.trim() || undefined,
      status: formData.status,
      observacoes: formData.observacoes.trim() || undefined,
      clienteId: formData.clienteId || undefined
    });

    onOpenChange(false);
  };

  const handleAssociateClient = (clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId);
    if (cliente) {
      // Buscar a origem do cliente nos origens disponíveis
      const origemCliente = cliente.origem || '';
      
      setFormData(prev => ({
        ...prev,
        clienteId,
        nome: cliente.nome,
        email: cliente.email || '',
        telefone: cliente.telefone || cliente.whatsapp || '',
        origem: origemCliente
      }));
    }
  };

    return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Novo Lead' : 'Editar Lead'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' ? 'Preencha os dados para criar um novo lead' : 'Edite as informações do lead'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Associar cliente existente */}
          <div className="space-y-2">
            <Label>Cliente Existente (Opcional)</Label>
            <Select value={formData.clienteId} onValueChange={handleAssociateClient}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar cliente existente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map(cliente => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.nome} - {cliente.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                className={errors.nome ? 'border-red-500' : ''}
              />
              {errors.nome && <p className="text-sm text-red-500">{errors.nome}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                className={errors.telefone ? 'border-red-500' : ''}
                placeholder="(11) 99999-9999"
              />
              {errors.telefone && <p className="text-sm text-red-500">{errors.telefone}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="origem">Origem</Label>
                <Select value={formData.origem} onValueChange={(value) => setFormData(prev => ({ ...prev, origem: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {origens.map(origem => (
                      <SelectItem key={origem.id} value={origem.nome}>
                        {origem.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map(status => (
                      <SelectItem key={status.id} value={status.key}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {mode === 'create' ? 'Criar Lead' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}