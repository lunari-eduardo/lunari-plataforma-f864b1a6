
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import { getBudgetStatusConfig } from '@/utils/statusConfig';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOrcamentoData } from '@/hooks/useOrcamentoData';

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
  const { pacotes, getCategoriaNameById } = useOrcamentoData();

  // Check if appointment is from a closed budget (origem: orcamento)
  const isFromClosedBudget = isAppointment && (event.originalData as any).origem === 'orcamento';

  // Get package info for the event
  const getPackageInfo = () => {
    if (isAppointment) {
      const appointment = event.originalData as any;
      
      // Para agendamentos, buscar dados reais do pacote se packageId existe
      let category = appointment.category || '';
      let packageName = appointment.type || '';
      
      // Tentar buscar dados do pacote via packageId se disponível
      if (appointment.packageId && pacotes.length > 0) {
        const packageData = pacotes.find(p => p.id === appointment.packageId);
        if (packageData) {
          packageName = packageData.nome;
          category = packageData.categoria;
        }
      }
      
      // Fallback: se não tem categoria mas tem packageId, tentar buscar por categoria_id
      if (!category && appointment.packageId) {
        const packageData = pacotes.find(p => p.id === appointment.packageId);
        if (packageData && packageData.categoriaId) {
          category = getCategoriaNameById(packageData.categoriaId);
        }
      }
      
      return {
        packageName: packageName,
        category: category,
        description: appointment.description || ''
      };
    } else {
      const budget = event.originalData as any;
      
      // Para orçamentos fechados, buscar dados do pacote se disponível
      let category = budget.categoria || '';
      let packageName = budget.pacote || '';
      
      // Se tem packageId nos dados do orçamento, buscar dados reais do pacote
      if (budget.packageId && pacotes.length > 0) {
        const packageData = pacotes.find(p => p.id === budget.packageId);
        if (packageData) {
          packageName = packageData.nome;
          category = packageData.categoria;
        }
      }
      
      // Se não tem pacote separado mas tem categoria, usar categoria como base
      if (!packageName && category) {
        packageName = category;
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
        // Agendamentos Diretos: verificar status
        const appointmentStatus = event.status;
        if (appointmentStatus === 'a confirmar') {
          // Status 'a confirmar': Laranja
          return 'bg-orange-100 text-orange-800 border-l-4 border-orange-500 hover:bg-orange-200';
        } else {
          // Outros status: Azul claro sólido
          return 'bg-blue-100 text-blue-800 border-l-4 border-blue-500 hover:bg-blue-200';
        }
      }
    } else {
      // Outros Orçamentos: Manter borda tracejada e fundo semi-transparente
      const config = getBudgetStatusConfig(event.status);
      const baseStyle = 'border-2 border-dashed hover:bg-opacity-80';
      return `${config.bgColor} ${config.textColor} ${config.borderColor} ${baseStyle}`;
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
      // Weekly view: Only client name, no time
      return (
        <div className="font-medium text-xs truncate">
          {event.client}
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
