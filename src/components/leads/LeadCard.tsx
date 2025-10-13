import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, MessageCircle, Calendar } from "lucide-react";
import type { Lead } from "@/types/leads";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadActionsPopover from "./LeadActionsPopover";
import LeadStatusSelector from "./LeadStatusSelector";
import LeadDetailsModal from "./LeadDetailsModal";
import LeadActionButtons from "./LeadActionButtons";
import FollowUpCounter from "./FollowUpCounter";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { useLeadInteractions } from "@/hooks/useLeadInteractions";
import { useFollowUpSystem } from "@/hooks/useFollowUpSystem";
import { useAppContext } from "@/contexts/AppContext";
import { checkLeadClientDivergence } from "@/utils/leadClientSync";
import { toast } from "sonner";
interface LeadCardProps {
  lead: Lead;
  onDelete: () => void;
  onConvertToClient: () => void;
  onRequestMove?: (status: string) => void;
  statusOptions: {
    value: string;
    label: string;
  }[];
  onScheduleClient?: () => void;
  onMarkAsScheduled?: () => void;
  onViewAppointment?: () => void;
  onDirectScheduling?: () => void;
  dndRef?: (node: HTMLElement | null) => void;
  dndListeners?: any;
  dndAttributes?: any;
  dndStyle?: any;
  isDragging?: boolean;
}
export default function LeadCard({
  lead,
  onDelete,
  onConvertToClient,
  onRequestMove,
  statusOptions,
  onScheduleClient,
  onMarkAsScheduled,
  onViewAppointment,
  onDirectScheduling,
  dndRef,
  dndListeners,
  dndAttributes,
  dndStyle,
  isDragging = false,
}: LeadCardProps) {
  const [isPressing, setIsPressing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { statuses } = useLeadStatuses();
  const { addInteraction } = useLeadInteractions();
  const { config } = useFollowUpSystem();
  const { clientes } = useAppContext();

  // Check CRM client status and calculate dot color
  const crmDot = useMemo(() => {
    if (!lead.clienteId) return { show: false };

    const client = clientes.find((c) => c.id === lead.clienteId);
    if (!client) return { show: true, color: "bg-red-500", title: "Cliente não encontrado" };

    const divergence = checkLeadClientDivergence(lead);
    if (divergence.hasDivergence) {
      return { show: true, color: "bg-red-500", title: "Dados desatualizados" };
    }

    return { show: true, color: "bg-green-500", title: "Vinculado ao CRM" };
  }, [lead, clientes]);

  // Calcular a data da última alteração real
  const lastUpdateIso = useMemo(() => {
    // Prioridade: statusTimestamp > ultimaInteracao > dataCriacao
    if (lead.statusTimestamp) return lead.statusTimestamp;
    if (lead.ultimaInteracao) return lead.ultimaInteracao;
    return lead.dataCriacao;
  }, [lead.statusTimestamp, lead.ultimaInteracao, lead.dataCriacao]);

  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNowStrict(new Date(lastUpdateIso), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return "Data inválida";
    }
  }, [lastUpdateIso]);

  const createdAgo = useMemo(() => {
    try {
      return formatDistanceToNowStrict(new Date(lead.dataCriacao), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return "Data inválida";
    }
  }, [lead.dataCriacao]);
  const isConverted = lead.status === "fechado";
  const isLost = lead.status === "perdido";
  const statusColor = useMemo(() => {
    const status = statuses.find((s) => s.key === lead.status);
    return status?.color || "#6b7280"; // gray fallback
  }, [lead.status, statuses]);

  // Calculate if lead needs follow-up display
  const showFollowUpBadge = useMemo(() => {
    if (!config.ativo || lead.status !== config.statusMonitorado) return false;

    const statusChangeDate = lead.statusTimestamp || lead.dataCriacao;
    const daysSinceChange = Math.floor(
      (new Date().getTime() - new Date(statusChangeDate).getTime()) / (1000 * 60 * 60 * 24),
    );

    return daysSinceChange >= config.diasParaFollowUp;
  }, [lead, config]);

  // Get scheduling status badge
  const getSchedulingBadge = () => {
    if (lead.scheduledAppointmentId) {
      return { text: "Agendado", color: "bg-green-100 text-green-800 border-green-200" };
    }
    if (lead.needsScheduling) {
      return { text: "Agendar", color: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    }
    return null;
  };

  const schedulingBadge = getSchedulingBadge();
  const handleStartConversation = () => {
    try {
      const telefone = lead.telefone.replace(/\D/g, "");
      const mensagem = `Olá ${lead.nome}! 😊\n\nVi que você demonstrou interesse em nossos serviços. Como posso ajudá-lo(a)?`;
      const mensagemCodificada = encodeURIComponent(mensagem);
      const link = `https://wa.me/55${telefone}?text=${mensagemCodificada}`;
      window.open(link, "_blank");
      toast.success("WhatsApp aberto para conversa");

      // Registrar interação de conversa
      addInteraction(lead.id, "conversa", "Conversa iniciada via WhatsApp", false);

      // Move para "aguardando" se ainda estiver em "novo_interessado"
      if (lead.status === "novo_interessado") {
        onRequestMove?.("aguardando");
      }
    } catch (error) {
      toast.error("Erro ao abrir WhatsApp");
    }
  };
  return (
    <li
      className={`relative overflow-hidden rounded-lg p-2 transition-all cursor-grab active:cursor-grabbing select-none touch-none transform-gpu border ${isDragging ? "opacity-50 scale-95" : ""} ${isPressing ? "scale-[0.98]" : ""} 
      bg-gradient-to-br from-gray-100 to-white border-lunar-border shadow-sm
      dark:from-gray-800 dark:to-gray-700 dark:border-lunar-border
      `}
      style={dndStyle}
      ref={dndRef as any}
      {...(dndAttributes || {})}
      {...(dndListeners || {})}
      onPointerDownCapture={(e) => {
        const target = e.target as HTMLElement;
        if (target?.closest('[data-no-drag="true"]')) {
          e.stopPropagation();
        }
      }}
      onMouseDown={() => setIsPressing(true)}
      onMouseUp={() => setIsPressing(false)}
      onMouseLeave={() => setIsPressing(false)}
    >
      {/* Barra lateral colorida para identificação do status */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{
          backgroundColor: statusColor,
        }}
      />

      {/* Layout em Grid: Nome + Menu no topo */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1">
          <h3 className="text-xs font-medium text-lunar-text leading-tight">{lead.nome}</h3>
          {crmDot.show && <div className={`w-2 h-2 rounded-full ${crmDot.color}`} title={crmDot.title} />}
        </div>

        <LeadActionsPopover
          lead={lead}
          onStartConversation={handleStartConversation}
          onShowDetails={() => setShowDetails(true)}
          onConvert={onConvertToClient}
          onDelete={onDelete}
          onScheduleClient={onScheduleClient}
          onMarkAsScheduled={onMarkAsScheduled}
          onViewAppointment={onViewAppointment}
        >
          <Button variant="ghost" size="icon" className="h-5 w-5 -mt-1 -mr-1" title="Mais opções" data-no-drag="true">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </LeadActionsPopover>
      </div>

      {/* Badges de Status */}
      <div className="mb-3 space-y-1">
        {/* Badge de Origem */}
        {lead.origem && (
          <div>
            <Badge
              style={{
                backgroundColor: `${statusColor}20`,
                color: statusColor,
                borderColor: `${statusColor}40`,
              }}
              className="text-2xs px-2 py-0"
            >
              {lead.origem}
            </Badge>
          </div>
        )}

        {/* Follow-up Counter for orcamento_enviado status */}
        {lead.status === "orcamento_enviado" && (
          <div>
            <FollowUpCounter statusTimestamp={lead.statusTimestamp} />
          </div>
        )}

        {/* Badge de Follow-up */}
        {showFollowUpBadge && (
          <div>
            <Badge className="text-2xs px-2 py-0 bg-red-100 text-red-800 border-red-200">Follow-up</Badge>
          </div>
        )}

        {/* Badge de Agendamento */}
        {schedulingBadge && (
          <div>
            <Badge className={`text-2xs px-2 py-0 ${schedulingBadge.color}`}>{schedulingBadge.text}</Badge>
          </div>
        )}

        {/* Loss Reason Badge */}
        {lead.status === "perdido" && !lead.motivoPerda && (
          <div>
            <Badge
              variant="outline"
              className="text-2xs border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/20"
            >
              Motivo pendente
            </Badge>
          </div>
        )}
      </div>

      {/* Status Selector Centralizado */}
      <div className="flex justify-center mb-3">
        <LeadStatusSelector
          lead={lead}
          onStatusChange={(status) => {
            onRequestMove?.(status);
            toast.success("Status alterado");
          }}
        />
      </div>

      {/* Datas + WhatsApp */}
      <div className="space-y-1 mb-2">
        <div className="flex items-center justify-between text-xs text-lunar-textSecondary">
          <span className="text-xs font-extralight">Última alteração: {timeAgo}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-lunar-textSecondary">
          <span className="text-xs font-extralight">Criado em: {createdAgo}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
            onClick={handleStartConversation}
            title="Conversar no WhatsApp"
            data-no-drag="true"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Action buttons for "aguardando" status */}
      <LeadActionButtons lead={lead} />

      {/* Direct scheduling button for converted leads */}
      {isConverted && onDirectScheduling && (
        <div className="mt-3 pt-3 border-t border-gray-200/60 dark:border-gray-700/60">
          <Button
            onClick={onDirectScheduling}
            size="sm"
            className="w-full bg-lunar-accent hover:bg-lunar-accent/90 text-white"
            data-no-drag="true"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Agendar Cliente
          </Button>
        </div>
      )}

      {/* Details Modal */}
      <LeadDetailsModal
        lead={lead}
        open={showDetails}
        onOpenChange={setShowDetails}
        onConvert={onConvertToClient}
        onDelete={onDelete}
      />
    </li>
  );
}
