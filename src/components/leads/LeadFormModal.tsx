import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import type { Lead } from '@/types/leads';
import type { OrigemCliente } from '@/types/orcamentos';

interface LeadFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial?: Lead;
  onSubmit: (data: Omit<Lead, 'id' | 'dataCriacao'>) => void;
}

interface FormData {
  nome: string;
  email: string;
  telefone: string;
  origem: string;
  status: string;
  observacoes: string;
  clienteId: string;
}

export default function LeadFormModal({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit
}: LeadFormModalProps) {
  const { origens: contextOrigens, clientes } = useAppContext();
  const { statuses, getDefaultOpenKey } = useLeadStatuses();
  
  // Unified origin source: AppContext + fallback to default origins
  const origens: OrigemCliente[] = contextOrigens.length > 0 
    ? contextOrigens 
    : ORIGENS_PADRAO.map(origem => ({
        id: origem.id,
        nome: origem.nome,
        cor: origem.cor
      }));

  const getInitialFormData = useCallback((): FormData => ({
    nome: '',
    email: '',
    telefone: '',
    origem: '',
    status: getDefaultOpenKey() || 'novo_contato',
    observacoes: '',
    clienteId: ''
  }), [getDefaultOpenKey]);

  const [formData, setFormData] = useState<FormData>(getInitialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes or mode changes
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
      setIsSubmitting(false);
    }
  }, [open, mode, initial, getInitialFormData]);

  const handleClose = useCallback((newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      setFormData(getInitialFormData());
      setErrors({});
    }
    onOpenChange(newOpen);
  }, [onOpenChange, getInitialFormData, isSubmitting]);

  const validateForm = useCallback((): boolean => {
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
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSubmitting) return;
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await onSubmit({
        nome: formData.nome.trim(),
        email: formData.email.trim(),
        telefone: formData.telefone.trim(),
        origem: formData.origem.trim() || undefined,
        status: formData.status,
        observacoes: formData.observacoes.trim() || undefined,
        clienteId: formData.clienteId || undefined
      });

      handleClose(false);
    } catch (error) {
      console.error('Erro ao salvar lead:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, onSubmit, handleClose, isSubmitting]);

  const handleAssociateClient = useCallback((clienteId: string) => {
    if (!clienteId) {
      setFormData(prev => ({ ...prev, clienteId: '' }));
      return;
    }

    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    // Smart origin lookup
    let origemEncontrada = '';
    
    if (cliente.origem) {
      // Try finding by name first
      const origemPorNome = origens.find(o => o.nome === cliente.origem);
      if (origemPorNome) {
        origemEncontrada = origemPorNome.nome;
      } else {
        // Try by ID
        const origemPorId = origens.find(o => o.id === cliente.origem);
        if (origemPorId) {
          origemEncontrada = origemPorId.nome;
        } else {
          // Use original string
          origemEncontrada = cliente.origem;
        }
      }
    }
    
    console.log('🔍 Cliente associado:', {
      clienteId,
      origemCliente: cliente.origem,
      origemEncontrada,
      origensDisponiveis: origens.length
    });
    
    setFormData(prev => ({
      ...prev,
      clienteId,
      nome: cliente.nome,
      email: cliente.email || '',
      telefone: cliente.telefone || cliente.whatsapp || '',
      origem: origemEncontrada
    }));
  }, [clientes, origens]);

  const handleInputChange = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  // Prevent modal from closing when clicking on dropdowns
  const handleSelectOpenChange = useCallback((open: boolean, selectType: string) => {
    console.log('🔽 Select open changed:', { selectType, open });
  }, []);

  console.log('🎯 LeadFormModal render:', {
    open,
    mode,
    origensCount: origens.length,
    contextOrigensCount: contextOrigens.length,
    formDataStatus: formData.status,
    statusesCount: statuses.length
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Novo Lead' : 'Editar Lead'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' ? 'Preencha os dados para criar um novo lead' : 'Edite as informações do lead'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cliente Existente */}
          <div className="space-y-2">
            <Label>Cliente Existente (Opcional)</Label>
            <Select 
              value={formData.clienteId} 
              onValueChange={handleAssociateClient}
              onOpenChange={(open) => handleSelectOpenChange(open, 'cliente')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar cliente existente" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {clientes.map(cliente => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.nome} - {cliente.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => handleInputChange('nome', e.target.value)}
              className={errors.nome ? 'border-destructive' : ''}
              disabled={isSubmitting}
            />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={errors.email ? 'border-destructive' : ''}
              disabled={isSubmitting}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone *</Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) => handleInputChange('telefone', e.target.value)}
              className={errors.telefone ? 'border-destructive' : ''}
              placeholder="(11) 99999-9999"
              disabled={isSubmitting}
            />
            {errors.telefone && <p className="text-sm text-destructive">{errors.telefone}</p>}
          </div>

          {/* Origem e Status */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select 
                value={formData.origem} 
                onValueChange={(value) => handleInputChange('origem', value)}
                onOpenChange={(open) => handleSelectOpenChange(open, 'origem')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar origem" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {origens.map(origem => (
                    <SelectItem key={origem.id} value={origem.nome}>
                      <div className="flex items-center gap-2">
                        {origem.cor && (
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: origem.cor }}
                          />
                        )}
                        {origem.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => handleInputChange('status', value)}
                onOpenChange={(open) => handleSelectOpenChange(open, 'status')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {statuses.map(status => (
                    <SelectItem key={status.id} value={status.key}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => handleInputChange('observacoes', e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : (mode === 'create' ? 'Criar Lead' : 'Salvar Alterações')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}