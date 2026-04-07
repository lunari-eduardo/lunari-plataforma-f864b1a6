import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Calendar, Palette, CheckSquare, Image } from 'lucide-react';
import { useFormularioRespostas } from '@/hooks/useFormularios';
import { FormularioCampo } from '@/types/formulario';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FormularioRespostasViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formularioId: string;
  titulo: string;
  campos: FormularioCampo[];
}

export function FormularioRespostasView({
  open,
  onOpenChange,
  formularioId,
  titulo,
  campos,
}: FormularioRespostasViewProps) {
  const { data: respostas, isLoading } = useFormularioRespostas(formularioId);

  const resposta = respostas?.[0]; // Pegar a resposta mais recente
  const camposOrdenados = [...campos].sort((a, b) => a.ordem - b.ordem);

  const renderResposta = (campo: FormularioCampo, valor: any) => {
    if (valor === undefined || valor === null || valor === '') {
      return <span className="text-muted-foreground italic text-sm">Não respondido</span>;
    }

    switch (campo.tipo) {
      case 'texto_curto':
      case 'texto_longo':
        return <p className="text-sm whitespace-pre-wrap">{valor}</p>;

      case 'data':
        try {
          return (
            <p className="text-sm flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {format(new Date(valor), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          );
        } catch {
          return <p className="text-sm">{valor}</p>;
        }

      case 'selecao_unica':
        return (
          <Badge variant="secondary" className="text-sm font-normal">
            {valor}
          </Badge>
        );

      case 'multipla_escolha':
        return (
          <div className="flex flex-wrap gap-1.5">
            {(Array.isArray(valor) ? valor : [valor]).map((item: string, idx: number) => (
              <Badge key={idx} variant="secondary" className="text-xs font-normal flex items-center gap-1">
                <CheckSquare className="h-3 w-3" />
                {item}
              </Badge>
            ))}
          </div>
        );

      case 'upload_imagem':
      case 'upload_referencia':
        return (
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(valor) ? valor : [valor]).map((url: string, idx: number) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-24 h-24 rounded-lg overflow-hidden border hover:ring-2 ring-primary transition-all"
              >
                <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        );

      case 'selecao_cores':
        return (
          <p className="text-sm flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            {valor}
          </p>
        );

      default:
        return <p className="text-sm">{String(valor)}</p>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Respostas: {titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !resposta ? (
            <div className="text-center py-12 space-y-2">
              <Image className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma resposta recebida ainda</p>
            </div>
          ) : (
            <>
              {/* Respondent info */}
              {(resposta.respondente_nome || resposta.respondente_email) && (
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-muted-foreground mb-1">Respondido por</p>
                  <p className="text-sm font-medium">
                    {resposta.respondente_nome || 'Anônimo'}
                    {resposta.respondente_email && (
                      <span className="font-normal text-muted-foreground ml-1">
                        ({resposta.respondente_email})
                      </span>
                    )}
                  </p>
                  {resposta.submitted_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(resposta.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              )}

              {/* Answers */}
              {camposOrdenados.map((campo) => (
                <div key={campo.id} className="border rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{campo.label}</p>
                  {renderResposta(campo, resposta.respostas?.[campo.id])}
                </div>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
