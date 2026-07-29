import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, MessageCircle, Mail } from "lucide-react";
import { OriginBadge } from '@/components/shared/OriginBadge';
import { ClienteCompleto } from '@/types/cliente-supabase';

interface ClientHeaderProps {
  cliente: ClienteCompleto;
  onBack: () => void;
}

export function ClientHeader({ cliente, onBack }: ClientHeaderProps) {
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  };

  const whatsapp = ((cliente as any).whatsapp || cliente.telefone) as string | null;

  return (
    <header className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Voltar para Clientes"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs">{getInitials(cliente.nome)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-heading text-[17px] font-semibold tracking-tight text-foreground">
              {cliente.nome}
            </h1>
            <OriginBadge originId={cliente.origem} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Perfil completo do cliente</p>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {whatsapp && (
          <Button asChild variant="outline" size="sm" className="h-8 shrink-0 whitespace-nowrap text-xs">
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5 text-accent-gold" />
              WhatsApp
            </a>
          </Button>
        )}
        {cliente.email && (
          <Button asChild variant="outline" size="sm" className="h-8 shrink-0 whitespace-nowrap text-xs">
            <a href={`mailto:${cliente.email}`}>
              <Mail className="mr-1.5 h-3.5 w-3.5 text-accent-gold" />
              E-mail
            </a>
          </Button>
        )}
      </div>
    </header>
  );
}
