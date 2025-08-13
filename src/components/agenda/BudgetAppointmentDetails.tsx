import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateForInput, safeParseInputDate, formatDateForStorage } from '@/utils/dateUtils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, User, Package, DollarSign, FileText, ExternalLink } from "lucide-react";
import { toast } from 'sonner';
import { Appointment } from "@/hooks/useAgenda";
import { Orcamento } from "@/types/orcamentos";
interface BudgetAppointmentDetailsProps {
  appointment: Appointment;
  budget: Orcamento | null;
  onSave: (appointmentData: {
    date: Date;
    time: string;
    description?: string;
  }) => void;
  onCancel: () => void;
  onViewFullBudget: () => void;
  onDelete: (id: string) => void;
}
export default function BudgetAppointmentDetails({
  appointment,
  budget,
  onSave,
  onCancel,
  onViewFullBudget,
  onDelete
}: BudgetAppointmentDetailsProps) {
  const [formData, setFormData] = useState({
    date: appointment.date,
    time: appointment.time,
    description: appointment.description || ''
  });

  // Estado local para o input de data bruto
  const [dateInputValue, setDateInputValue] = useState(formatDateForInput(appointment.date));
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Manipular input de data (somente atualiza o texto)
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateInputValue(e.target.value);
  };

  // Validar e converter data quando o usuário sai do campo
  const handleDateInputBlur = () => {
    const parsedDate = safeParseInputDate(dateInputValue);
    if (parsedDate) {
      setFormData(prev => ({
        ...prev,
        date: parsedDate
      }));
    } else {
      // Se inválida, volta ao valor anterior
      setDateInputValue(formatDateForInput(formData.date));
    }
  };

  // Sincronizar o input quando o campo recebe foco
  const handleDateInputFocus = () => {
    setDateInputValue(formatDateForInput(formData.date));
  };
  const handleSave = () => {
    onSave({
      date: formData.date,
      time: formData.time,
      description: formData.description
    });
    toast.success('Reagendamento salvo com sucesso');
  };
  if (!budget) {
    return <div className="space-y-4 text-center py-8">
        <p className="text-lunar-textSecondary">Orçamento original não encontrado</p>
        <Button variant="outline" onClick={onCancel}>Fechar</Button>
      </div>;
  }
  const valorTotal = budget.valorFinal || budget.valorTotal;
  return <div className="space-y-2 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      {/* Header com badge identificador */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Calendar className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-lunar-text">Agendamento de Orçamento</h2>
        </div>
        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
          Orçamento Fechado
        </Badge>
      </div>

      {/* Seção 1: Detalhes do Orçamento Original (Somente Leitura) */}
      <Card className="bg-lunar-surface/30 border-lunar-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Detalhes do Orçamento Original
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cliente */}
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-lunar-textSecondary mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="text-sm font-medium text-lunar-text">{budget.cliente.nome}</div>
              <div className="text-xs text-lunar-textSecondary space-y-0.5">
                {budget.cliente.email && <div>📧 {budget.cliente.email}</div>}
                {budget.cliente.telefone && <div>📱 {budget.cliente.telefone}</div>}
              </div>
            </div>
          </div>

          <Separator />

          {/* Categoria e Descrição */}
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium text-lunar-text">Categoria: </span>
              <span className="text-lunar-textSecondary">{budget.categoria}</span>
            </div>
            {budget.descricao && <div className="text-sm">
                <span className="font-medium text-lunar-text">Serviço: </span>
                <span className="text-lunar-textSecondary">{budget.descricao}</span>
              </div>}
          </div>

          <Separator />

          {/* Pacotes e Produtos */}
          {budget.pacotes.length > 0 && <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-lunar-text">
                <Package className="h-4 w-4" />
                Pacotes Incluídos
              </div>
              <div className="space-y-1">
                {budget.pacotes.map((pacote, index) => <div key={index} className="flex justify-between items-center text-xs bg-lunar-bg/50 p-2 rounded">
                    <div>
                      <span className="font-medium">{pacote.nome}</span>
                      {pacote.quantidade > 1 && <span className="text-lunar-textSecondary"> x{pacote.quantidade}</span>}
                    </div>
                    <span className="text-lunar-textSecondary">
                      R$ {(pacote.preco * pacote.quantidade).toFixed(2)}
                    </span>
                  </div>)}
              </div>
            </div>}

          <Separator />

          {/* Valor Total */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-[hsl(var(--lunar-success)/0.12)] border-[hsl(var(--lunar-success)/0.30)]">
            <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--lunar-success))]">
              <DollarSign className="h-4 w-4" />
              Valor Total
            </div>
            <div className="text-lg font-semibold text-[hsl(var(--lunar-success))]">
              R$ {valorTotal.toFixed(2)}
            </div>
          </div>

          {/* Link para ver orçamento completo */}
          <Button variant="outline" size="sm" onClick={onViewFullBudget} className="w-full text-xs hover:bg-transparent hover:border-border transition-colors">
            <ExternalLink className="h-3 w-3 mr-2" />
            Ver Orçamento Completo
          </Button>
        </CardContent>
      </Card>

      {/* Seção 2: Reagendamento (Editável) */}
      <Card className="border-lunar-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Reagendamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="text-xs font-medium text-lunar-text">
                Nova Data
              </Label>
              <Input id="date" name="date" type="date" value={dateInputValue} onChange={handleDateInputChange} onBlur={handleDateInputBlur} onFocus={handleDateInputFocus} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="time" className="text-xs font-medium text-lunar-text">
                Novo Horário
              </Label>
              <Input id="time" name="time" type="time" value={formData.time} onChange={handleChange} className="mt-1" />
            </div>
          </div>

          {/* Observações adicionais */}
          <div>
            <Label htmlFor="description" className="text-xs font-medium text-lunar-text">
              Observações do Reagendamento
            </Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Motivo do reagendamento, informações adicionais..." className="mt-1 min-h-[60px]" />
          </div>

          {/* Informação sobre sincronização */}
          <div className="text-xs text-lunar-textSecondary bg-primary/10 border border-primary/30 p-2 rounded">
            💡 As alterações de data e horário serão sincronizadas automaticamente com o orçamento original.
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-between pt-4">
        
        <div className="space-x-2">
          <Button variant="outline" onClick={onCancel} className="text-xs">
            Fechar
          </Button>
          <Button onClick={handleSave} className="text-xs bg-green-600 hover:bg-green-700">
            Salvar Reagendamento
          </Button>
        </div>
      </div>
    </div>;
}