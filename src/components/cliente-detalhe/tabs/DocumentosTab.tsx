import { Upload } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { ClienteFormulariosList } from '@/components/formularios/ClienteFormulariosList';
import { ClienteContratosList } from '@/components/contratos/ClienteContratosList';
import { ClienteCompleto } from '@/types/cliente-supabase';

interface DocumentosTabProps {
  cliente: ClienteCompleto;
}

export function DocumentosTab({ cliente }: DocumentosTabProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Formulários / Briefings */}
      <section>
        <ClienteFormulariosList
          clienteId={cliente.id}
          clienteNome={cliente.nome}
          clienteTelefone={cliente.telefone || cliente.whatsapp || undefined}
        />
      </section>

      <Separator />

      {/* Contratos */}
      <section>
        <ClienteContratosList clienteId={cliente.id} clienteNome={cliente.nome} />
      </section>

      <Separator />

      {/* Documentos do Cliente */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Documentos do Cliente
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie todos os documentos relacionados a este cliente
          </p>
        </div>
        <FileUploadZone
          clienteId={cliente?.id}
          description="Documento do cliente"
          showExisting={true}
        />
      </section>
    </div>
  );
}
