
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  dataCadastro: string;
  ultimaSessao: string;
  proximaSessao: string | null;
  categorias: string[];
  totalSessoes: number;
  totalPago: number;
  valorPendente: number;
}

interface ClientFormProps {
  client?: Cliente | null;
  onSave: (clientData: any) => void;
  onCancel: () => void;
}

export default function ClientForm({ client, onSave, onCancel }: ClientFormProps) {
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    endereco: '',
    observacoes: ''
  });

  useEffect(() => {
    if (client) {
      setFormData({
        nome: client.nome,
        telefone: client.telefone,
        email: client.email,
        endereco: client.endereco,
        observacoes: ''
      });
    } else {
      setFormData({
        nome: '',
        telefone: '',
        email: '',
        endereco: '',
        observacoes: ''
      });
    }
  }, [client]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validação básica
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    // Validação de e-mail (opcional, mas se preenchido deve ser válido)
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('E-mail inválido');
        return;
      }
    }

    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome *</Label>
        <Input
          id="nome"
          name="nome"
          value={formData.nome}
          onChange={handleChange}
          placeholder="Nome completo do cliente"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            name="telefone"
            value={formData.telefone}
            onChange={handleChange}
            placeholder="(Opcional) +55 (11) 00000-0000"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="(Opcional) cliente@email.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="endereco">Endereço</Label>
        <Input
          id="endereco"
          name="endereco"
          value={formData.endereco}
          onChange={handleChange}
          placeholder="Rua, número, bairro - Cidade, Estado"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          value={formData.observacoes}
          onChange={handleChange}
          placeholder="Informações adicionais sobre o cliente..."
          className="min-h-[80px]"
        />
      </div>

      <div className="flex justify-end pt-4 space-x-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {client ? 'Atualizar' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
