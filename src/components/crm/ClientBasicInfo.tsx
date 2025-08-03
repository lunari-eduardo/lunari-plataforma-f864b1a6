import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientMetrics } from '@/hooks/useClientMetrics';
import { User, Phone, Mail } from 'lucide-react';

interface ClientBasicInfoProps {
  client: ClientMetrics;
}

export function ClientBasicInfo({ client }: ClientBasicInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Informações do Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg">{client.nome}</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{client.email || 'Email não informado'}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{client.telefone}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}