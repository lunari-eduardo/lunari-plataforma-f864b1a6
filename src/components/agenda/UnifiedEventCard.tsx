
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import { getBudgetStatusConfig } from '@/utils/statusConfig';
import { useIsMobile } from '@/hooks/use-mobile';

interface UnifiedEventCardProps {
  event: UnifiedEvent;
  onClick: (event: UnifiedEvent) => void;
  compact?: boolean;
  variant?: 'daily' | 'weekly' | 'monthly';
}

export default function UnifiedEventCard({ event, onClick, compact = false, variant = 'daily' }: UnifiedEventCardProps) {
  const isAppointment = event.type === 'appointment';
  const isBudget = event.type === 'budget';
  const isMobile = useIsMobile();

  // Check if appointment is from a closed budget (origem: orcamento)
  const isFromClosedBudget = isAppointment && (event.originalData as any).origem === 'orcamento';

  // Get package info for the event
  const getPackageInfo = () => {
    if (isAppointment) {
      const appointment = event.originalData as any;
      
      // Para agendamentos, precisamos separar categoria do nome do pacote
      // O 'type' geralmente contém o nome do pacote/serviço
      // Vamos buscar a categoria real baseada no packageId se disponível
      let category = '';
      let packageName = appointment.type || '';
      
      // Se tem packageId, tentar buscar dados do pacote
      if (appointment.packageId) {
        // O packageName deve ser o type, e a categoria deve vir dos dados do pacote
        // Por enquanto, vamos usar uma lógica simples para extrair categoria do type
        if (packageName.toLowerCase().includes('gestante')) {
          category = 'Gestante';
        } else if (packageName.toLowerCase().includes('família')) {
          category = 'Família';
        } else if (packageName.toLowerCase().includes('corporativo')) {
          category = 'Corporativo';
        } else if (packageName.toLowerCase().includes('sessão')) {
          category = 'Sessão';
          // Se é só "Sessão", pode ser que precise de mais info
          if (packageName === 'Sessão') {
            packageName = 'Sessão Individual';
          }
        } else {
          category = 'Outros';
        }
      }
      
      return {
        packageName: packageName,
        category: category,
        description: appointment.description || ''
      };
    } else {
      const budget = event.originalData as any;
      
      // Para orçamentos, separar categoria do pacote se estão juntos
      let category = budget.categoria || '';
      let packageName = '';
      
      // Se tem campo separado para pacote, usar ele
      if (budget.pacote && budget.pacote !== budget.categoria) {
        packageName = budget.pacote;
      } else if (budget.categoria) {
        // Se só tem categoria, usar ela como base
        category = budget.categoria;
        packageName = budget.categoria; // Temporário até ter dados melhores
      }
      
      return {
        packageName: packageName,
        category: category,
        description: budget.descricao || ''
      };
    }
  };

  const { packageName, category, description } = getPackageInfo();

  // New color system based on specifications
  const getEventStyles = () => {
    if (isAppointment) {
      if (isFromClosedBudget) {
        // Orçamentos Fechados (que viraram agendamentos): Verde sólido
        return 'bg-green-100 text-green-800 border-l-4 border-green-500 hover:bg-green-200';
      } else {
        // Agendamentos Diretos: Azul claro sólido
        return 'bg-blue-100 text-blue-800 border-l-4 border-blue-500 hover:bg-blue-200';
      }
    } else {
      // Outros Orçamentos: Manter borda tracejada e fundo semi-transparente
      const config = getBudgetStatusConfig(event.status);
      const baseStyle = 'border-2 border-dashed hover:bg-opacity-80';
      return `${config.bgColor.replace('100', '50')} ${config.textColor} ${config.borderColor.replace('border-', 'border-').replace('500', '300')} hover:${config.bgColor} ${baseStyle}`;
    }
  };

  // Render content based on variant and screen size
  const renderCardContent = () => {
    if (variant === 'daily') {
      // Daily view: 3 lines of detailed info
      return (
        <div className="space-y-1">
          {/* Line 1: Client Name (bold) */}
          <div className="font-semibold text-sm truncate">
            {event.client}
          </div>
          {/* Line 2: Service Description */}
          <div className="text-xs opacity-80 truncate">
            {description}
          </div>
           {/* Line 3: Category - Package Name */}
           <div className="text-xs opacity-70 truncate">
             {category && packageName && category !== packageName ? `${category} - ${packageName}` : packageName || category}
           </div>
        </div>
      );
    } else if (variant === 'weekly') {
      // Weekly view: Compact with essential info
      return (
        <div className="space-y-0.5">
          <div className="font-medium text-xs truncate">
            {event.client}
          </div>
          <div className="text-xs opacity-70">
            {event.time}
          </div>
        </div>
      );
    } else if (variant === 'monthly') {
      // Monthly view: Responsive based on screen size
      if (isMobile) {
        // Mobile: Only client name
        return (
          <div className="text-xs font-medium truncate">
            {event.client}
          </div>
        );
      } else {
        // Desktop: Multiple lines with small font
        return (
          <div className="space-y-0.5">
            <div className="font-medium text-xs truncate">
              {event.client}
            </div>
            <div className="text-xs opacity-80 truncate">
              {description}
            </div>
            <div className="text-xs opacity-70 truncate">
              {category}
            </div>
          </div>
        );
      }
    }
    
    // Fallback for compact prop (backward compatibility)
    if (compact) {
      return (
        <div className="space-y-0.5">
          <div className="font-medium text-xs truncate">
            {event.client}
          </div>
          <div className="text-xs opacity-70">
            {event.time}
          </div>
        </div>
      );
    }

    // Default: Full info
    return (
      <div className="space-y-1">
        <div className="font-semibold text-sm truncate">
          {event.client}
        </div>
        <div className="text-xs opacity-80 truncate">
          {description}
        </div>
         <div className="text-xs opacity-70 truncate">
           {category && packageName && category !== packageName ? `${category} - ${packageName}` : packageName || category}
         </div>
      </div>
    );
  };

  return (
    <div
      onClick={() => onClick(event)}
      className={`
        p-2 rounded cursor-pointer transition-all duration-200
        ${getEventStyles()}
      `}
    >
      {renderCardContent()}
    </div>
  );
}
