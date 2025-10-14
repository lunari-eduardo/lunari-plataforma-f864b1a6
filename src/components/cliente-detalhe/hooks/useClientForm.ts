import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useClientValidation } from './useClientValidation';
import { ClienteCompleto } from '@/types/cliente-supabase';

export function useClientForm(cliente: ClienteCompleto | undefined, onUpdate: (id: string, data: any) => void) {
  const { validateForm } = useClientValidation();
  
  const [isEditing, setIsEditing] = useState(false);
  
  // Mapear família do Supabase para formato do form
  const mapFamiliaToForm = (cliente: ClienteCompleto | undefined) => {
    if (!cliente) return { conjuge: { nome: '', dataNascimento: '' }, filhos: [] };
    
    const conjugeData = cliente.familia?.find(f => f.tipo === 'conjuge');
    const filhosData = cliente.familia?.filter(f => f.tipo === 'filho') || [];
    
    return {
      conjuge: {
        nome: conjugeData?.nome || '',
        dataNascimento: conjugeData?.data_nascimento || ''
      },
      filhos: filhosData.map(f => ({
        id: f.id,
        nome: f.nome || '',
        dataNascimento: f.data_nascimento || ''
      }))
    };
  };

  const [formData, setFormData] = useState({
    nome: cliente?.nome || '',
    email: cliente?.email || '',
    telefone: cliente?.telefone || '',
    endereco: cliente?.endereco || '',
    observacoes: cliente?.observacoes || '',
    origem: cliente?.origem || '',
    dataNascimento: cliente?.data_nascimento || '',
    ...mapFamiliaToForm(cliente)
  });

  // Sincronizar formData quando cliente muda
  useEffect(() => {
    if (!cliente || isEditing) return;

    const familiaData = mapFamiliaToForm(cliente);
    const nextData = {
      nome: cliente.nome || '',
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      endereco: cliente.endereco || '',
      observacoes: cliente.observacoes || '',
      origem: cliente.origem || '',
      dataNascimento: cliente.data_nascimento || '',
      ...familiaData
    };

    // Evitar re-render desnecessário e loops
    const isSame = JSON.stringify(nextData) === JSON.stringify(formData);
    if (isSame) return;

    setFormData(nextData);
  }, [cliente, isEditing]);

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
    
    const familiaData = mapFamiliaToForm(cliente);
    setFormData({
      nome: cliente.nome,
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      endereco: cliente.endereco || '',
      observacoes: cliente.observacoes || '',
      origem: cliente.origem || '',
      dataNascimento: cliente.data_nascimento || '',
      ...familiaData
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
      conjuge: { 
        nome: prev.conjuge?.nome || '', 
        dataNascimento: prev.conjuge?.dataNascimento || '',
        [field]: value 
      }
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