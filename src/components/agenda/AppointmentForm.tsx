import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectModal as Select, SelectModalContent as SelectContent, SelectModalItem as SelectItem, SelectModalTrigger as SelectTrigger, SelectModalValue as SelectValue } from "@/components/ui/select-in-modal";
import { useDialogDropdownContext } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNumberInput } from '@/hooks/useNumberInput';
import ClientSearchCombobox from './ClientSearchCombobox';
import PackageSearchCombobox from './PackageSearchCombobox';
import { useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { useIntegration } from '@/hooks/useIntegration';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import { CategorySelector } from '@/components/ui/category-selector';
import { configurationService } from '@/services/ConfigurationService';
import { ChevronDown, Plus, FileText, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  label: 'Pendente',
  emoji: '🟠'
}, {
  value: 'confirmado',
  label: 'Confirmado',
  emoji: '🟢'
}];

export default function AppointmentForm({
  initialDate = new Date(),
  initialTime = '09:00',
  appointment = null,
  onSave,
  onCancel
}: AppointmentFormProps) {
  const {
    selectedClientForScheduling,
    clearSelectedClientForScheduling,
    appointments
  } = useContext(AppContext);
  
  // Use Supabase realtime for clients
  const { clientes, adicionarCliente } = useClientesRealtime();
  const {
    isFromBudget
  } = useIntegration();
  const {
    pacotes,
    produtos,
    categorias
  } = useOrcamentos();
  const {
    origens
  } = useOrcamentos();
  const dropdownContext = useDialogDropdownContext();

  // Verifica se é agendamento de orçamento
  const isFromBudgetAppointment = appointment ? isFromBudget(appointment) : false;

  // Definir estado ativo da tab (novo cliente ou cliente existente)
  const [activeTab, setActiveTab] = useState<string>('existing');

  // Estados para campos colapsáveis
  const [showValorPago, setShowValorPago] = useState(false);
  const [showDescricao, setShowDescricao] = useState(false);
  
  // Estado para animação do valor do pacote
  const [valorPacoteAnimating, setValorPacoteAnimating] = useState(false);
  
  // ✅ FASE 2: Estado para prevenir cliques duplos no submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para os campos do formulário
  const [formData, setFormData] = useState({
    date: initialDate,
    time: initialTime,
    clientId: '',
    status: 'a confirmar',
    description: '',
    packageId: '',
    categoria: '',
    paidAmount: 0,
    valorPacote: 0,
    // Campos para novo cliente
    newClientName: '',
    newClientPhone: '',
    newClientEmail: '',
    newClientOrigem: ''
  });

  // Enhanced number input for paid amount
  const paidAmountInput = useNumberInput({
    value: formData.paidAmount,
    onChange: value => setFormData(prev => ({
      ...prev,
      paidAmount: parseFloat(value) || 0
    }))
  });
  
  // Enhanced number input for package value
  const valorPacoteInput = useNumberInput({
    value: formData.valorPacote,
    onChange: value => setFormData(prev => ({
      ...prev,
      valorPacote: parseFloat(value) || 0
    }))
  });

  // Se estiver editando, preencher com dados existentes
  useEffect(() => {
    if (appointment) {
      const client = clientes.find(c => c.nome === appointment.client);

      // Carregar categoria do pacote existente
      let categoria = '';
      let valorPacote = 0;
      if (appointment.packageId) {
        const selectedPackage = pacotes.find(p => p.id === appointment.packageId);
        if (selectedPackage) {
          valorPacote = selectedPackage.valor_base || 0;
          if (selectedPackage.categoria_id) {
            try {
              const configCategorias = configurationService.loadCategorias();
              const categoriaObj = configCategorias.find((cat) => cat.id === selectedPackage.categoria_id || cat.id === String(selectedPackage.categoria_id));
              categoria = categoriaObj?.nome || '';
            } catch {
              categoria = '';
            }
          }
        }
      }
      
      // Abrir campos colapsáveis se já tem valor
      if (appointment.paidAmount && appointment.paidAmount > 0) {
        setShowValorPago(true);
      }
      if (appointment.description) {
        setShowDescricao(true);
      }
      
      setFormData({
        date: appointment.date,
        time: appointment.time,
        clientId: client?.id || '',
        status: appointment.status,
        description: appointment.description || '',
        packageId: appointment.packageId || '',
        categoria,
        paidAmount: appointment.paidAmount || 0,
        valorPacote,
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
  }, [appointment, clientes, selectedClientForScheduling, clearSelectedClientForScheduling, pacotes]);

  // Manipular mudanças nos campos
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'paidAmount' || name === 'valorPacote' ? parseFloat(value) || 0 : value
    }));
  };

  // Manipular seleção de cliente existente
  const handleClientSelect = (clientId: string) => {
    setFormData(prev => ({
      ...prev,
      clientId
    }));
  };

  // Manipular seleção de categoria
  const handleCategorySelect = (categoria: string) => {
    setFormData(prev => ({
      ...prev,
      categoria,
      packageId: '' // Limpar pacote ao mudar categoria
    }));
  };

  // Manipular seleção de pacote com animação
  const handlePackageSelect = (packageId: string) => {
    const selectedPackage = pacotes.find(p => p.id === packageId);
    let categoria = '';
    let valorPacote = 0;
    
    if (selectedPackage) {
      valorPacote = selectedPackage.valor_base || 0;
      if (selectedPackage.categoria_id) {
        try {
          const configCategorias = configurationService.loadCategorias();
          const categoriaObj = configCategorias.find((cat) => cat.id === selectedPackage.categoria_id || cat.id === String(selectedPackage.categoria_id));
          categoria = categoriaObj?.nome || '';
        } catch {
          categoria = '';
        }
      }
    }
    
    // Trigger animation
    setValorPacoteAnimating(true);
    setTimeout(() => setValorPacoteAnimating(false), 600);
    
    setFormData(prev => ({
      ...prev,
      packageId,
      categoria,
      valorPacote
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

  // Função para verificar conflitos de horário
  const checkForConflicts = () => {
    if (formData.status === 'confirmado') {
      const existingConfirmed = appointments.find(app => app.id !== appointment?.id &&
      app.status === 'confirmado' && app.date.toDateString() === formData.date.toDateString() && app.time === formData.time);
      if (existingConfirmed) {
        return `Já existe um agendamento confirmado para ${existingConfirmed.client} às ${formData.time} neste dia.`;
      }
    }
    return null;
  };

  // Formatar telefone automaticamente
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) {
      return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    }
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7,11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData(prev => ({
      ...prev,
      newClientPhone: formatted
    }));
  };

  // Manipular envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ FASE 2: Prevenir submissões duplicadas
    if (isSubmitting) {
      console.log('⚠️ [AppointmentForm] Submissão já em andamento - ignorando');
      return;
    }
    setIsSubmitting(true);

    try {
      // Validar campos obrigatórios
      if (activeTab === 'new' && !formData.newClientName) {
        toast.error('Nome do cliente é obrigatório');
        setIsSubmitting(false);
        return;
      }
      if (activeTab === 'existing' && !formData.clientId) {
        toast.error('Selecione um cliente');
        setIsSubmitting(false);
        return;
      }

      // Verificar conflitos de horário
      const conflictError = checkForConflicts();
      if (conflictError) {
        toast.error(conflictError);
        setIsSubmitting(false);
        return;
      }
    let clientInfo;
    if (activeTab === 'new') {
      // Criar novo cliente no CRM automaticamente usando Supabase
      const novoCliente = await adicionarCliente({
        nome: formData.newClientName,
        telefone: formData.newClientPhone || '',
        email: formData.newClientEmail || '',
        origem: formData.newClientOrigem || ''
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
    let packageType = 'Sessão';
    let packageCategory = '';
    if (selectedPackage) {
      packageType = selectedPackage.nome;
      if (selectedPackage.categoria_id) {
        try {
          const configCategorias = configurationService.loadCategorias();
          const categoria = configCategorias.find((cat) => cat.id === selectedPackage.categoria_id || cat.id === String(selectedPackage.categoria_id));
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
        type: packageCategory || 'Sessão',
        category: packageType,
        status: formData.status as 'confirmado' | 'a confirmar',
        description: formData.description,
        packageId: formData.packageId,
        produtosIncluidos: produtosIncluidos.length > 0 ? produtosIncluidos : undefined,
        paidAmount: formData.paidAmount,
        valorPacote: formData.valorPacote,
        client: clientInfo.client,
        clientId: clientInfo.clientId,
        whatsapp: clientInfo.clientPhone,
        email: clientInfo.clientEmail,
        clientPhone: clientInfo.clientPhone,
        clientEmail: clientInfo.clientEmail
      };
      onSave(appointmentData);
    } catch (error) {
      console.error('❌ [AppointmentForm] Erro ao salvar:', error);
      toast.error('Erro ao salvar agendamento');
    } finally {
      // ✅ FASE 2: Reset após um delay para permitir animação de fechamento
      setTimeout(() => setIsSubmitting(false), 1000);
    }
  };

  return (
    <div className="space-y-5">
      {isFromBudgetAppointment && (
        <div className="p-4 bg-muted border border-border rounded-lg">
          <p className="text-sm font-medium text-foreground mb-1">📋 Agendamento de Orçamento</p>
          <p className="text-xs text-muted-foreground">
            Este agendamento foi criado automaticamente a partir de um orçamento fechado. 
            Apenas data e horário podem ser editados aqui.
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ========== SEÇÃO 1: CLIENTE (CRM / Novo) ========== */}
        {!isFromBudgetAppointment && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">Cliente</Label>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="existing" className="text-sm">Cliente do CRM</TabsTrigger>
                <TabsTrigger value="new" className="text-sm">Novo Cliente</TabsTrigger>
              </TabsList>
              
              <TabsContent value="existing" className="mt-3 space-y-3">
                <ClientSearchCombobox 
                  value={formData.clientId} 
                  onSelect={handleClientSelect} 
                  placeholder="Buscar cliente no CRM..." 
                />
                <p className="text-xs text-muted-foreground">
                  💡 Clientes são gerenciados na página CRM. <a href="/app/clientes" className="text-primary hover:underline">Ver todos</a>
                </p>
              </TabsContent>
              
              <TabsContent value="new" className="mt-3 space-y-3">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-client-name" className="text-sm font-medium">Nome *</Label>
                    <Input 
                      id="new-client-name" 
                      name="newClientName" 
                      value={formData.newClientName} 
                      onChange={handleChange} 
                      placeholder="Nome completo" 
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="new-client-phone" className="text-sm font-medium">Telefone</Label>
                    <Input 
                      id="new-client-phone" 
                      name="newClientPhone" 
                      value={formData.newClientPhone} 
                      onChange={handlePhoneChange} 
                      placeholder="(51) 99999-9999" 
                    />
                  </div>
                  
                  <div className="space-y-1.5">
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
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="new-client-origem" className="text-sm font-medium">Como conheceu?</Label>
                    <Select 
                      value={formData.newClientOrigem} 
                      onValueChange={value => setFormData(prev => ({ ...prev, newClientOrigem: value }))} 
                      onOpenChange={open => dropdownContext?.setHasOpenDropdown(open)}
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
                  🆕 O cliente será criado no CRM automaticamente.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        )}
        
        {/* ========== SEÇÃO 2: PACOTE ========== */}
        {!isFromBudgetAppointment && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Categoria (Opcional)</Label>
              <CategorySelector 
                categorias={categorias} 
                value={formData.categoria} 
                onValueChange={handleCategorySelect} 
                placeholder="Filtrar pacotes por categoria..." 
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="package-search-input" className="text-sm font-medium">Pacote</Label>
              <PackageSearchCombobox 
                value={formData.packageId} 
                onSelect={handlePackageSelect} 
                placeholder="Buscar pacote..." 
                filtrarPorCategoria={formData.categoria} 
              />
            </div>
            
            {formData.packageId && getIncludedProducts().length > 0 && (
              <div className="p-3 bg-muted border border-border rounded-lg">
                <h4 className="text-sm font-medium text-foreground mb-2">📦 Produtos Incluídos</h4>
                <div className="space-y-1">
                  {getIncludedProducts().map((produto, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="text-foreground">{produto.nome}</span>
                      <span className="font-medium text-muted-foreground">Qtd: {produto.quantidade}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* ========== SEÇÃO 3: VALOR DO PACOTE (com animação) ========== */}
        {!isFromBudgetAppointment && (
          <div className="space-y-1.5">
            <Label htmlFor="valor-pacote" className="text-sm font-medium">Valor do pacote</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input 
                id="valor-pacote"
                name="valorPacote"
                type="number"
                min="0"
                step="0.01"
                value={valorPacoteInput.displayValue}
                onChange={valorPacoteInput.handleChange}
                onFocus={valorPacoteInput.handleFocus}
                className={cn(
                  "pl-9 transition-all duration-300",
                  valorPacoteAnimating && "ring-2 ring-green-500/50 bg-green-50 dark:bg-green-950/20"
                )}
                placeholder="0,00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Preenchido automaticamente pelo pacote. Você pode ajustar.
            </p>
          </div>
        )}
        
        {/* ========== SEÇÃO 4: STATUS DO AGENDAMENTO (toggle segmentado full-width) ========== */}
        {!isFromBudgetAppointment && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status do Agendamento</Label>
            <div className="grid grid-cols-2 w-full">
              {availableStatus.map((status, index) => (
                <Button 
                  key={status.value} 
                  type="button" 
                  variant={formData.status === status.value ? "default" : "outline"} 
                  onClick={() => handleStatusSelect(status.value)} 
                  className={cn(
                    "text-sm h-11",
                    index === 0 && "rounded-r-none border-r-0",
                    index === 1 && "rounded-l-none",
                    formData.status === status.value 
                      ? status.value === 'a confirmar' 
                        ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' 
                        : 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                      : status.value === 'a confirmar' 
                        ? 'border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20' 
                        : 'border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20'
                  )}
                >
                  {status.emoji} {status.label}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        {/* ========== SEÇÃO 5: VALOR PAGO (colapsável) ========== */}
        {!isFromBudgetAppointment && (
          <Collapsible open={showValorPago} onOpenChange={setShowValorPago}>
            {!showValorPago ? (
              <CollapsibleTrigger asChild>
                <button 
                  type="button"
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <DollarSign className="h-4 w-4" />
                  Adicionar valor pago (sinal)
                </button>
              </CollapsibleTrigger>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="appointment-paid-amount" className="text-sm font-medium">Valor pago (sinal)</Label>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowValorPago(false);
                      setFormData(prev => ({ ...prev, paidAmount: 0 }));
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Remover
                  </button>
                </div>
                <CollapsibleContent className="animate-fade-in">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input 
                      id="appointment-paid-amount" 
                      name="paidAmount" 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      value={paidAmountInput.displayValue} 
                      onChange={paidAmountInput.handleChange} 
                      onFocus={paidAmountInput.handleFocus} 
                      className="pl-9"
                      placeholder="Ex: 50,00" 
                    />
                  </div>
                </CollapsibleContent>
              </div>
            )}
          </Collapsible>
        )}
        
        {/* ========== SEÇÃO 6: DESCRIÇÃO (colapsável) ========== */}
        {!isFromBudgetAppointment && (
          <Collapsible open={showDescricao} onOpenChange={setShowDescricao}>
            {!showDescricao ? (
              <CollapsibleTrigger asChild>
                <button 
                  type="button"
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <FileText className="h-4 w-4" />
                  Adicionar descrição da sessão
                </button>
              </CollapsibleTrigger>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="appointment-description" className="text-sm font-medium">Descrição</Label>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowDescricao(false);
                      setFormData(prev => ({ ...prev, description: '' }));
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Remover
                  </button>
                </div>
                <CollapsibleContent className="animate-fade-in">
                  <Textarea 
                    id="appointment-description" 
                    name="description" 
                    value={formData.description} 
                    onChange={handleChange} 
                    placeholder="Detalhes da sessão..." 
                    className="min-h-[100px] resize-none" 
                  />
                </CollapsibleContent>
              </div>
            )}
          </Collapsible>
        )}
        
        {/* ========== BOTÕES DE AÇÃO ========== */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
