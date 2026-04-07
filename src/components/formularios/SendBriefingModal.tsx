import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Copy, Send, FileText, Clock, Loader2, Check } from 'lucide-react';
import { useFormularioTemplates } from '@/hooks/useFormularioTemplates';
import { useFormularios } from '@/hooks/useFormularios';
import type { FormularioTemplate } from '@/types/formulario';

interface SendBriefingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome: string;
  clienteTelefone?: string;
  sessionId?: string;
}

export function SendBriefingModal({
  open,
  onOpenChange,
  clienteId,
  clienteNome,
  clienteTelefone,
  sessionId,
}: SendBriefingModalProps) {
  const { templates, isLoading: loadingTemplates } = useFormularioTemplates();
  const { createFormulario, publishFormulario, isCreating } = useFormularios();
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const handleSelectTemplate = async (template: FormularioTemplate) => {
    try {
      const formulario = await createFormulario({
        titulo: template.nome,
        titulo_cliente: `${template.nome} - ${clienteNome}`,
        descricao: template.descricao || undefined,
        campos: template.campos,
        mensagem_conclusao: 'Obrigado! Suas respostas foram recebidas com sucesso. 💜',
        tempo_estimado: template.tempo_estimado,
        template_id: template.id,
        cliente_id: clienteId,
        session_id: sessionId,
      });

      if (formulario?.id) {
        await publishFormulario(formulario.id);
        const token = formulario.public_token;
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/formulario/${token}`;
        setCreatedLink(link);
        setCreatedToken(token);
      }
    } catch (err) {
      console.error('Erro ao criar briefing:', err);
    }
  };

  const handleCopyLink = () => {
    if (createdLink) {
      navigator.clipboard.writeText(createdLink);
      toast({ title: 'Link copiado!' });
    }
  };

  const handleSendWhatsApp = () => {
    if (!createdLink || !clienteTelefone) return;
    const telefone = clienteTelefone.replace(/\D/g, '');
    const mensagem = encodeURIComponent(
      `Olá ${clienteNome}! 😊\n\nPreciso de algumas informações para preparar sua sessão. Por favor, preencha o formulário abaixo:\n\n📋 ${createdLink}\n\nÉ rápido e fácil! Qualquer dúvida, estou à disposição. 🤝`
    );
    window.open(`https://wa.me/55${telefone}?text=${mensagem}`, '_blank');
  };

  const handleClose = () => {
    setCreatedLink(null);
    setCreatedToken(null);
    onOpenChange(false);
  };

  // Agrupar templates por categoria
  const categorias = templates.reduce((acc, t) => {
    const cat = t.categoria || 'Geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {} as Record<string, FormularioTemplate[]>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col" overlayClassName="backdrop-blur-sm bg-black/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {createdLink ? 'Briefing Criado!' : 'Enviar Briefing'}
          </DialogTitle>
        </DialogHeader>

        {createdLink ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-500" />
              Formulário criado e publicado para <strong>{clienteNome}</strong>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm font-mono break-all">
              {createdLink}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCopyLink} variant="outline" className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copiar link
              </Button>
              {clienteTelefone && (
                <Button onClick={handleSendWhatsApp} className="flex-1 bg-green-600 hover:bg-green-700">
                  <Send className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum template disponível. Crie um em Configurações → Formulários.
              </p>
            ) : (
              Object.entries(categorias).map(([categoria, temps]) => (
                <div key={categoria} className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {categoria}
                  </h3>
                  {temps.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      disabled={isCreating}
                      className="w-full text-left p-3 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">{template.nome}</p>
                          {template.descricao && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {template.descricao}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {template.tempo_estimado}min
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {template.campos.length} campos
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
