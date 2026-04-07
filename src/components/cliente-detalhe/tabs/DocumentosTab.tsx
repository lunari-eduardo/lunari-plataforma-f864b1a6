import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Upload } from "lucide-react";
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { ClienteFormulariosList } from '@/components/formularios/ClienteFormulariosList';
import { ClienteCompleto } from '@/types/cliente-supabase';

interface DocumentosTabProps {
  cliente: ClienteCompleto;
}

export function DocumentosTab({ cliente }: DocumentosTabProps) {
  return (
    <div className="space-y-4">
      {/* Formulários / Briefings */}
      <Card>
        <CardContent className="pt-6">
          <ClienteFormulariosList
            clienteId={cliente.id}
            clienteNome={cliente.nome}
            clienteTelefone={cliente.telefone || cliente.whatsapp || undefined}
          />
        </CardContent>
      </Card>

      {/* Documentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Documentos do Cliente
          </CardTitle>
          <CardDescription>
            Gerencie todos os documentos relacionados a este cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadZone clienteId={cliente?.id} description="Documento do cliente" showExisting={true} />
        </CardContent>
      </Card>
    </div>
  );
}
