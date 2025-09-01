import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, MessageCircle, Mail } from 'lucide-react';
import { OriginBadge } from '@/components/shared/OriginBadge';
import { Cliente } from '@/types/orcamentos';

interface ClientHeaderProps {
  cliente: Cliente;
}

const getInitials = (name?: string) => {
  if (!name) return '';
  const parts = name.trim().split(' ');
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

export const ClientHeader = memo(({ cliente }: ClientHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
      {/* Back Button */}
      <div className="flex items-center">
        <Button 
          onClick={() => navigate('/clientes')} 
          variant="outline" 
          size="sm" 
          className="h-8 text-xs"
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Voltar
        </Button>
      </div>

      {/* Avatar + Name + Origin */}
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8 md:h-10 md:w-10">
          <AvatarFallback className="text-xs md:text-sm">
            {getInitials(cliente.nome)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm md:text-base">{cliente.nome}</h1>
            <OriginBadge originId={cliente.origem} />
          </div>
          <p className="text-muted-foreground text-[11px] md:text-xs">
            Perfil completo do cliente
          </p>
        </div>
      </div>

      {/* Action Buttons with horizontal scroll on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {cliente.telefone && (
          <Button 
            asChild 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs whitespace-nowrap flex-shrink-0"
          >
            <a 
              href={`https://wa.me/${cliente.telefone.replace(/\D/g, '')}`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-3 w-3 mr-1" />
              WhatsApp
            </a>
          </Button>
        )}
        {cliente.email && (
          <Button 
            asChild 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs whitespace-nowrap flex-shrink-0"
          >
            <a href={`mailto:${cliente.email}`}>
              <Mail className="h-3 w-3 mr-1" />
              E-mail
            </a>
          </Button>
        )}
      </div>
    </div>
  );
});

ClientHeader.displayName = 'ClientHeader';