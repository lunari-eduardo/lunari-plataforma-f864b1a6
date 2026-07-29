import { Upload } from 'lucide-react';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { ClienteFormulariosList } from '@/components/formularios/ClienteFormulariosList';
import { ClienteContratosList } from '@/components/contratos/ClienteContratosList';
import { ClienteCompleto } from '@/types/cliente-supabase';
import { SECTION_SURFACE, SECTION_TITLE } from '@/lib/dialogTokens';

interface DocumentosTabProps {
  cliente: ClienteCompleto;
}

export function DocumentosTab({ cliente }: DocumentosTabProps) {
  return (
    <div className="space-y-4">
      <section className={SECTION_SURFACE}>
        <ClienteFormulariosList
          clienteId={cliente.id}
          clienteNome={cliente.nome}
          clienteTelefone={cliente.telefone || cliente.whatsapp || undefined}
        />
      </section>

      <section className={SECTION_SURFACE}>
        <ClienteContratosList clienteId={cliente.id} clienteNome={cliente.nome} />
      </section>

      <section className={SECTION_SURFACE}>
        <div className="mb-3">
          <h3 className={SECTION_TITLE}>
            <Upload className="h-3.5 w-3.5 text-accent-gold" />
            Documentos do cliente
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
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
