import { useState } from 'react';
import { toast } from 'sonner';
import { useClientValidation } from './useClientValidation';

interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  endereco?: string;
  observacoes?: string;
  origem?: string;
  dataNascimento?: string;
  conjuge?: { nome?: string; dataNascimento?: string };
  filhos?: { id: string; nome?: string; dataNascimento?: string }[];
}

export function useClientForm(cliente: Cliente | undefined, onUpdate: (id: string, data: any) => void) {
  const { validateForm } = useClientValidation();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nome: cliente?.nome || '',
    email: cliente?.email || '',
    telefone: cliente?.telefone || '',
    endereco: cliente?.endereco || '',
    observacoes: cliente?.observacoes || '',
    origem: cliente?.origem || '',
    dataNascimento: cliente?.dataNascimento || '',
    conjuge: (cliente as any)?.conjuge || { nome: '', dataNascimento: '' },
    filhos: (((cliente as any)?.filhos) || []) as { id: string; nome?: string; dataNascimento?: string }[],
  });

  // Sincronizar formData quando cliente muda
  useState(() => {
    if (cliente) {
      setFormData({
        nome: cliente.nome || '',
        email: cliente.email || '',
        telefone: cliente.telefone || '',
        endereco: cliente.endereco || '',
        observacoes: cliente.observacoes || '',
        origem: cliente.origem || '',
        dataNascimento: cliente.dataNascimento || '',
        conjuge: (cliente as any)?.conjuge || { nome: '', dataNascimento: '' },
        filhos: (((cliente as any)?.filhos) || []) as { id: string; nome?: string; dataNascimento?: string }[],
      });
    }
  });

  const handleSave = () => {
    if (!cliente) return;
    
    const validation = validateForm(formData);
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }
    
    onUpdate(cliente.id, formData);
    setIsEditing(false);
    toast.success('Cliente atualizado com sucesso');
  };

  const handleCancel = () => {
    if (!cliente) return;
    
    setFormData({
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      endereco: cliente.endereco || '',
      observacoes: cliente.observacoes || '',
      origem: cliente.origem || '',
      dataNascimento: cliente.dataNascimento || '',
      conjuge: (cliente as any).conjuge || { nome: '', dataNascimento: '' },
      filhos: ((cliente as any).filhos || []) as { id: string; nome?: string; dataNascimento?: string }[],
    });
    setIsEditing(false);
  };

  const addFilho = () => {
    setFormData(prev => ({
      ...prev,
      filhos: ([...(prev.filhos || []), { id: `filho_${Date.now()}`, nome: '', dataNascimento: '' }])
    }));
  };

  const removeFilho = (id: string) => {
    setFormData(prev => ({
      ...prev,
      filhos: (prev.filhos || []).filter(f => f.id !== id)
    }));
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateConjuge = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      conjuge: { ...(prev.conjuge || {}), [field]: value }
    }));
  };

  const updateFilho = (filhoId: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      filhos: (prev.filhos || []).map(f => 
        f.id === filhoId ? { ...f, [field]: value } : f
      )
    }));
  };

  return {
    formData,
    isEditing,
    setIsEditing,
    handleSave,
    handleCancel,
    addFilho,
    removeFilho,
    updateFormData,
    updateConjuge,
    updateFilho
  };
}