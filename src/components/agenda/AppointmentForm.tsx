import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  SelectModal as Select, 
  SelectModalContent as SelectContent, 
  SelectModalItem as SelectItem, 
  SelectModalTrigger as SelectTrigger, 
  SelectModalValue as SelectValue 
} from "@/components/ui/select-in-modal";
import { useDialogDropdownContext } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import ClientSearchCombobox from './ClientSearchCombobox';
import PackageSearchCombobox from './PackageSearchCombobox';
import { useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { useIntegration } from '@/hooks/useIntegration';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';

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
  label: 'Pendente'
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
    adicionarCliente,
    selectedClientForScheduling,
    clearSelectedClientForScheduling
  } = useContext(AppContext);
  const {
    isFromBudget
  } = useIntegration();
  const {
    pacotes,
    produtos
  } = useOrcamentos();
  
  const { origens } = useOrcamentos();
  const dropdownContext = useDialogDropdownContext();

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
    newClientEmail: '',
    newClientOrigem: ''
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
        newClientEmail: '',
        newClientOrigem: ''
      });
    } else if (selectedClientForScheduling) {
      // Se há cliente pré-selecionado (vindo do Kanban)
      setFormData(prev => ({
        ...prev,
        clientId: selectedClientForScheduling
      }));
      setActiveTab('existing');
      // Limpar após usar
      clearSelectedClientForScheduling();
    }
  }, [appointment, clientes, selectedClientForScheduling, clearSelectedClientForScheduling]);

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
        email: formData.newClientEmail,
        origem: formData.newClientOrigem
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

    // Obter dados do pacote selecionado para salvar nome e categoria corretos
    const selectedPackage = formData.packageId ? pacotes.find(p => p.id === formData.packageId) : null;
    let packageType = 'Sessão'; // Fallback padrão
    let packageCategory = '';
    
    if (selectedPackage) {
      packageType = selectedPackage.nome;
      // Buscar nome da categoria baseado no categoria_id
      if (selectedPackage.categoria_id) {
        try {
          const configCategorias = JSON.parse(localStorage.getItem('configuracoes_categorias') || '[]');
          const categoria = configCategorias.find((cat: any) => 
            cat.id === selectedPackage.categoria_id || cat.id === String(selectedPackage.categoria_id)
          );
          packageCategory = categoria?.nome || '';
        } catch (error) {
          console.error('Erro ao buscar categoria:', error);
        }
      }
    }

    // Preparar dados do agendamento
    const appointmentData = {
      date: formData.date,
      time: formData.time,
      title: clientInfo.client,
      type: packageType, // Nome real do pacote
      category: packageCategory, // Categoria do pacote
      status: formData.status as 'confirmado' | 'a confirmar',
      description: formData.description,
      packageId: formData.packageId,
      produtosIncluidos: produtosIncluidos.length > 0 ? produtosIncluidos : undefined,
      paidAmount: formData.paidAmount,
      client: clientInfo.client,
      clientId: clientInfo.clientId, // INCLUIR CLIENTEID
      whatsapp: clientInfo.clientPhone, // INCLUIR WHATSAPP
      email: clientInfo.clientEmail, // INCLUIR EMAIL
      clientPhone: clientInfo.clientPhone,
      clientEmail: clientInfo.clientEmail
    };
    onSave(appointmentData);
  };
  return <div className="space-y-6">
      {isFromBudgetAppointment && (
        <div className="p-4 bg-muted border border-border rounded-lg">
          <p className="text-sm font-medium text-foreground mb-1">📋 Agendamento de Orçamento</p>
          <p className="text-xs text-muted-foreground">
            Este agendamento foi criado automaticamente a partir de um orçamento fechado. 
            Apenas data e horário podem ser editados aqui. Para alterar outras informações, 
            vá para a página de Orçamentos ou Workflow.
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {!isFromBudgetAppointment && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Cliente</Label>
              <p className="text-xs text-muted-foreground mb-3">Complete os detalhes do agendamento abaixo.</p>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="existing" className="text-sm">Cliente do CRM</TabsTrigger>
                <TabsTrigger value="new" className="text-sm">Novo Cliente</TabsTrigger>
              </TabsList>
              
              <TabsContent value="existing" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <ClientSearchCombobox 
                    value={formData.clientId} 
                    onSelect={handleClientSelect} 
                    placeholder="Buscar cliente no CRM..." 
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Clientes são gerenciados na página CRM. <a href="/clientes" className="text-primary hover:underline">Ver todos os clientes</a>
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="new" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-client-name" className="text-sm font-medium">Nome *</Label>
                    <Input 
                      id="new-client-name" 
                      name="newClientName" 
                      value={formData.newClientName} 
                      onChange={handleChange} 
                      placeholder="Nome completo" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-client-phone" className="text-sm font-medium">Telefone *</Label>
                    <Input 
                      id="new-client-phone" 
                      name="newClientPhone" 
                      value={formData.newClientPhone} 
                      onChange={handleChange} 
                      placeholder="+55 (DDD) 00000-0000" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-client-email" className="text-sm font-medium">E-mail</Label>
                    <Input 
                      id="new-client-email" 
                      name="newClientEmail" 
                      type="email" 
                      value={formData.newClientEmail} 
                      onChange={handleChange} 
                      placeholder="email@exemplo.com" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-client-origem" className="text-sm font-medium">Como conheceu?</Label>
                     <Select 
                       value={formData.newClientOrigem} 
                       onValueChange={(value) => setFormData(prev => ({ ...prev, newClientOrigem: value }))}
                       onOpenChange={(open) => dropdownContext?.setHasOpenDropdown(open)}
                     >
                      <SelectTrigger id="new-client-origem">
                        <SelectValue placeholder="Selecione a origem" />
                      </SelectTrigger>
                      <SelectContent>
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
                </div>
                
                <p className="text-xs text-primary">
                  🆕 Novo cliente será automaticamente adicionado ao CRM
                </p>
              </TabsContent>
            </Tabs>
          </div>
        )}
        
        {!isFromBudgetAppointment && (
          <>
            <div className="space-y-2">
              <Label htmlFor="appointment-description" className="text-sm font-medium">Descrição</Label>
              <Textarea 
                id="appointment-description" 
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                placeholder="Detalhes da sessão..." 
                className="min-h-[80px] resize-none" 
              />
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="package-search-input" className="text-sm font-medium">Pacote</Label>
              <PackageSearchCombobox 
                value={formData.packageId} 
                onSelect={handlePackageSelect} 
                placeholder="Buscar pacote por nome ou categoria..." 
              />
              
              {formData.packageId && getIncludedProducts().length > 0 && (
                <div className="p-4 bg-muted border border-border rounded-lg">
                  <h4 className="text-sm font-medium text-foreground mb-3">📦 Produtos Incluídos neste Pacote</h4>
                  <div className="space-y-2">
                    {getIncludedProducts().map((produto, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-foreground">{produto.nome}</span>
                        <span className="font-medium text-muted-foreground">Qtd: {produto.quantidade}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 italic">
                    Estes produtos serão automaticamente incluídos no agendamento
                  </p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appointment-paid-amount" className="text-sm font-medium">Valor pago</Label>
                <Input 
                  id="appointment-paid-amount" 
                  name="paidAmount" 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={formData.paidAmount} 
                  onChange={handleChange} 
                  placeholder="0,00" 
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status do Agendamento</Label>
                <div className="flex gap-2">
                  {availableStatus.map(status => (
                    <Button
                      key={status.value}
                      type="button"
                      variant={formData.status === status.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusSelect(status.value)}
                      className={`flex-1 text-sm ${
                        formData.status === status.value
                          ? status.value === 'a confirmar'
                            ? 'bg-destructive hover:bg-destructive/90'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                          : status.value === 'a confirmar'
                            ? 'border-destructive text-destructive hover:bg-destructive/10'
                            : 'border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
                      }`}
                    >
                      {status.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
        
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            Salvar
          </Button>
        </div>
      </form>
    </div>;
}