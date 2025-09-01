import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { FileUploadZone } from '@/components/shared/FileUploadZone';

interface Cliente {
  id: string;
  nome: string;
}

interface DocumentosTabProps {
  cliente: Cliente;
}

export function DocumentosTab({ cliente }: DocumentosTabProps) {
  return (
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
  );
}