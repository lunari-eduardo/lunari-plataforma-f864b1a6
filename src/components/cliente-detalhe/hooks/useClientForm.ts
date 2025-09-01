import { useState, useCallback, useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { Cliente } from '@/types/orcamentos';
import { toast } from 'sonner';

interface ClientFormData {
  nome: string;
  email: string;
  telefone: string;
  endereco: string;
  observacoes: string;
  origem: string;
  dataNascimento: string;
  conjuge: { nome?: string; dataNascimento?: string };
  filhos: { id: string; nome?: string; dataNascimento?: string }[];
}

export function useClientForm(cliente: Cliente) {
  const { atualizarCliente } = useContext(AppContext);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState<ClientFormData>({
    nome: cliente.nome || '',
    email: cliente.email || '',
    telefone: cliente.telefone || '',
    endereco: cliente.endereco || '',
    observacoes: cliente.observacoes || '',
    origem: cliente.origem || '',
    dataNascimento: cliente.dataNascimento || '',
    conjuge: (cliente as any).conjuge || { nome: '', dataNascimento: '' },
    filhos: (((cliente as any)?.filhos) || []) as { id: string; nome?: string; dataNascimento?: string }[]
  });

  const handleSave = useCallback(() => {
    if (!formData.nome || !formData.telefone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }
    
    atualizarCliente(cliente.id, formData);
    setIsEditing(false);
    toast.success('Cliente atualizado com sucesso');
  }, [formData, cliente.id, atualizarCliente]);

  const handleCancel = useCallback(() => {
    setFormData({
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      endereco: cliente.endereco || '',
      observacoes: cliente.observacoes || '',
      origem: cliente.origem || '',
      dataNascimento: cliente.dataNascimento || '',
      conjuge: (cliente as any).conjuge || { nome: '', dataNascimento: '' },
      filhos: ((cliente as any).filhos || []) as { id: string; nome?: string; dataNascimento?: string }[]
    });
    setIsEditing(false);
  }, [cliente]);

  const addFilho = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      filhos: [...(prev.filhos || []), { id: `filho_${Date.now()}`, nome: '', dataNascimento: '' }]
    }));
  }, []);

  const removeFilho = useCallback((id: string) => {
    setFormData(prev => ({
      ...prev,
      filhos: (prev.filhos || []).filter(f => f.id !== id)
    }));
  }, []);

  const updateFormData = useCallback((updates: Partial<ClientFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const updateFilho = useCallback((id: string, updates: Partial<{ nome: string; dataNascimento: string }>) => {
    setFormData(prev => ({
      ...prev,
      filhos: (prev.filhos || []).map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  }, []);

  const updateConjuge = useCallback((updates: Partial<{ nome?: string; dataNascimento?: string }>) => {
    setFormData(prev => ({
      ...prev,
      conjuge: { ...(prev.conjuge || { nome: '', dataNascimento: '' }), ...updates }
    }));
  }, []);

  return {
    formData,
    isEditing,
    setIsEditing,
    handleSave,
    handleCancel,
    addFilho,
    removeFilho,
    updateFormData,
    updateFilho,
    updateConjuge
  };
}