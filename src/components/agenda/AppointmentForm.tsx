import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import ClientSearchCombobox from './ClientSearchCombobox';
import PackageSearchCombobox from './PackageSearchCombobox';
import { useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { useIntegration } from '@/hooks/useIntegration';
import { useOrcamentos } from '@/hooks/useOrcamentos';

// Tipo de agendamento
type Appointment = {
  id: string;
  title: string;
  date: Date;
  time: string;
  type: string;
  client: string;
  status: 'confirmado' | 'a confirmar';
  description?: string;
  packageId?: string;
  produtosIncluidos?: Array<{
    id: string;
    nome: string;
    quantidade: number;
    valorUnitario: number;
    tipo: 'incluso' | 'manual';
  }>;
  paidAmount?: number;
};

// Props do componente
interface AppointmentFormProps {
  initialDate?: Date;
  initialTime?: string;
  appointment?: Appointment | null;
  onSave: (appointmentData: any) => void;
  onCancel: () => void;
}

// Lista de status disponíveis
const availableStatus = [{
  value: 'a confirmar',
  label: 'A Confirmar'
}, {
  value: 'confirmado',
  label: 'Confirmado'
}];

// Integrado com hook real de clientes

export default function AppointmentForm({
  initialDate = new Date(),
  initialTime = '09:00',
  appointment = null,
  onSave,
  onCancel
}: AppointmentFormProps) {
  const {
    clientes,
    adicionarCliente
  } = useContext(AppContext);
  const {
    isFromBudget
  } = useIntegration();
  const {
    pacotes,
    produtos
  } = useOrcamentos();

  // Verifica se é agendamento de orçamento
  const isFromBudgetAppointment = appointment ? isFromBudget(appointment) : false;

  // Definir estado ativo da tab (novo cliente ou cliente existente)
  const [activeTab, setActiveTab] = useState<string>('existing');

  // Estado para os campos do formulário
  const [formData, setFormData] = useState({
    date: initialDate,
    time: initialTime,
    clientId: '',
    status: 'a confirmar',
    description: '',
    packageId: '',
    paidAmount: 0,
    // Campos para novo cliente
    newClientName: '',
    newClientPhone: '',
    newClientEmail: ''
  });

  // Se estiver editando, preencher com dados existentes
  useEffect(() => {
    if (appointment) {
      const client = clientes.find(c => c.nome === appointment.client);
      setFormData({
        date: appointment.date,
        time: appointment.time,
        clientId: client?.id || '',
        status: appointment.status,
        description: appointment.description || '',
        packageId: appointment.packageId || '',
        paidAmount: appointment.paidAmount || 0,
        newClientName: '',
        newClientPhone: '',
        newClientEmail: ''
      });
    }
  }, [appointment, clientes]);

  // Manipular mudanças nos campos
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'paidAmount' ? parseFloat(value) || 0 : value
    }));
  };

  // Manipular seleção de cliente existente
  const handleClientSelect = (clientId: string) => {
    setFormData(prev => ({
      ...prev,
      clientId
    }));
  };

  // Manipular seleção de pacote
  const handlePackageSelect = (packageId: string) => {
    setFormData(prev => ({
      ...prev,
      packageId
    }));
  };

  // Obter produtos incluídos no pacote selecionado
  const getIncludedProducts = () => {
    if (!formData.packageId) return [];
    
    const selectedPackage = pacotes.find(p => p.id === formData.packageId);
    if (!selectedPackage?.produtosIncluidos) return [];
    
    return selectedPackage.produtosIncluidos.map(pi => {
      const produto = produtos.find(p => p.id === pi.produtoId);
      return {
        id: pi.produtoId,
        nome: produto?.nome || 'Produto não encontrado',
        quantidade: pi.quantidade,
        valorUnitario: produto?.valorVenda || 0,
        tipo: 'incluso' as const
      };
    });
  };

  // Manipular seleção de status
  const handleStatusSelect = (status: string) => {
    setFormData(prev => ({
      ...prev,
      status
    }));
  };

  // Manipular envio do formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validar campos obrigatórios
    if (activeTab === 'new' && (!formData.newClientName || !formData.newClientPhone)) {
      toast.error('Nome e telefone do cliente são obrigatórios');
      return;
    }
    if (activeTab === 'existing' && !formData.clientId) {
      toast.error('Selecione um cliente');
      return;
    }
    let clientInfo;
    if (activeTab === 'new') {
      // Criar novo cliente no CRM automaticamente
      const novoCliente = adicionarCliente({
        nome: formData.newClientName,
        telefone: formData.newClientPhone,
        email: formData.newClientEmail
      });
      clientInfo = {
        client: formData.newClientName,
        clientId: novoCliente.id,
        clientPhone: formData.newClientPhone,
        clientEmail: formData.newClientEmail
      };
      toast.success('Novo cliente adicionado ao CRM automaticamente');
    } else {
      // Usando cliente existente
      const selectedClient = clientes.find(c => c.id === formData.clientId);
      clientInfo = {
        client: selectedClient?.nome || '',
        clientId: selectedClient?.id || '',
        clientPhone: selectedClient?.telefone || '',
        clientEmail: selectedClient?.email || ''
      };
    }

    // Obter produtos incluídos no pacote
    const produtosIncluidos = getIncludedProducts();

    // Preparar dados do agendamento
    const appointmentData = {
      date: formData.date,
      time: formData.time,
      title: clientInfo.client,
      type: 'Sessão',
      status: formData.status as 'confirmado' | 'a confirmar',
      description: formData.description,
      packageId: formData.packageId,
      produtosIncluidos: produtosIncluidos.length > 0 ? produtosIncluidos : undefined,
      paidAmount: formData.paidAmount,
      client: clientInfo.client,
      clientId: clientInfo.clientId,
      clientPhone: clientInfo.clientPhone,
      clientEmail: clientInfo.clientEmail
    };
    onSave(appointmentData);
  };
  return <form onSubmit={handleSubmit} className="space-y-4 bg-lunar-surface/30 rounded-lg py-2 px-3">
      {isFromBudgetAppointment && <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-800 mb-1">📋 Agendamento de Orçamento</p>
          <p className="text-xs text-blue-600">
            Este agendamento foi criado automaticamente a partir de um orçamento fechado. 
            Apenas data e horário podem ser editados aqui. Para alterar outras informações, 
            vá para a página de Orçamentos ou Workflow.
          </p>
        </div>}
      
      {!isFromBudgetAppointment && <div className="space-y-2">
          <Label className="text-xs font-medium text-lunar-text">Cliente</Label>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-2 h-8">
            <TabsTrigger value="existing" className="text-xs">Cliente do CRM</TabsTrigger>
            <TabsTrigger value="new" className="text-xs">Novo Cliente</TabsTrigger>
          </TabsList>
          
          <TabsContent value="existing" className="space-y-4">
            <ClientSearchCombobox value={formData.clientId} onSelect={handleClientSelect} placeholder="Buscar cliente no CRM..." />
            <p className="text-[11px] text-lunar-textSecondary">
              💡 Clientes são gerenciados na página CRM. <a href="/clientes" className="text-lunar-accent hover:underline">Ver todos os clientes</a>
            </p>
          </TabsContent>
          
          <TabsContent value="new" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newClientName" className="text-xs font-medium">Nome*</Label>
              <Input id="newClientName" name="newClientName" value={formData.newClientName} onChange={handleChange} placeholder="Nome completo" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newClientPhone" className="text-xs font-medium">Telefone*</Label>
              <Input id="newClientPhone" name="newClientPhone" value={formData.newClientPhone} onChange={handleChange} placeholder="+55 (DDD) 00000-0000" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newClientEmail" className="text-xs font-medium">E-mail</Label>
              <Input id="newClientEmail" name="newClientEmail" type="email" value={formData.newClientEmail} onChange={handleChange} placeholder="email@exemplo.com" />
            </div>
            <p className="text-[11px] text-lunar-accent">
              🆕 Novo cliente será automaticamente adicionado ao CRM
            </p>
          </TabsContent>
        </Tabs>
        </div>}
      
      {/* Campos de data e hora sempre visíveis */}
      

      {!isFromBudgetAppointment && <>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-medium">Descrição</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Detalhes da sessão..." className="min-h-[80px]" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="package" className="text-xs font-medium">Pacote</Label>
            <PackageSearchCombobox value={formData.packageId} onSelect={handlePackageSelect} placeholder="Buscar pacote por nome ou categoria..." />
            
            {/* Seção de Produtos Incluídos - aparece quando pacote é selecionado */}
            {formData.packageId && getIncludedProducts().length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-xs font-medium text-blue-800 mb-2">📦 Produtos Incluídos neste Pacote</h4>
                <div className="space-y-1">
                  {getIncludedProducts().map((produto, index) => (
                    <div key={index} className="flex justify-between items-center text-xs text-blue-700">
                      <span>{produto.nome}</span>
                      <span className="font-medium">Qtd: {produto.quantidade}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-blue-600 mt-2 italic">
                  Estes produtos serão automaticamente incluídos no agendamento
                </p>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paidAmount" className="text-xs font-medium">Valor pago</Label>
              <Input id="paidAmount" name="paidAmount" type="number" min="0" step="0.01" value={formData.paidAmount} onChange={handleChange} placeholder="0.00" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status" className="text-xs font-medium">Status do Agendamento</Label>
              <Select value={formData.status} onValueChange={handleStatusSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {availableStatus.map(status => <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>}
      
      <div className="flex justify-end pt-4 space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} className="text-xs">
          Cancelar
        </Button>
        <Button type="submit" className="text-xs">
          Salvar
        </Button>
      </div>
    </form>;
}