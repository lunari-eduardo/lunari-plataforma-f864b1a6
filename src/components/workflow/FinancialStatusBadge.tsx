/**
 * ✅ FASE 4: Badge visual para status financeiro pré-calculado
 * Usa a coluna computada status_financeiro do Supabase
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface FinancialStatusBadgeProps {
  status?: 'pago' | 'parcial' | 'pendente' | string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig = {
  pago: { 
    color: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100', 
    icon: CheckCircle, 
    label: 'Pago' 
  },
  parcial: { 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100', 
    icon: Clock, 
    label: 'Parcial' 
  },
  pendente: { 
    color: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100', 
    icon: AlertCircle, 
    label: 'Pendente' 
  }
};

export const FinancialStatusBadge = React.memo(({ 
  status = 'pendente', 
  showLabel = true,
  size = 'sm'
}: FinancialStatusBadgeProps) => {
  const normalizedStatus = (status || 'pendente') as keyof typeof statusConfig;
  const config = statusConfig[normalizedStatus] || statusConfig.pendente;
  const Icon = config.icon;
  
  const sizeClasses = size === 'sm' 
    ? 'text-[10px] px-1.5 py-0.5 h-4' 
    : 'text-xs px-2 py-1 h-5';
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  
  return (
    <Badge 
      variant="outline" 
      className={`${config.color} ${sizeClasses} font-medium`}
    >
      <Icon className={`${iconSize} ${showLabel ? 'mr-1' : ''}`} />
      {showLabel && config.label}
    </Badge>
  );
});

FinancialStatusBadge.displayName = 'FinancialStatusBadge';
