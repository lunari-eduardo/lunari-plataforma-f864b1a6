import React, { useState } from 'react';
import { useLeadShares } from '@/hooks/useLeadShares';
import { useMaterials } from '@/hooks/useMaterials';
import { useMaterialShares } from '@/hooks/useMaterialShares';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Share2, Sparkles, Send, Eye, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface LeadCommercialSectionProps {
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
}

export default function LeadCommercialSection({ leadId, leadName, leadPhone }: LeadCommercialSectionProps) {
  const { shares, isLoading: isLoadingShares } = useLeadShares(leadId);
  const { materials, isLoading: isLoadingMaterials } = useMaterials();
  const { createShare } = useMaterialShares(undefined); // We'll pass materialId when mutating

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');
  const [generatedShare, setGeneratedShare] = useState<any>(null);

  const activeMaterials = materials.filter(m => m.status === 'active' && !!m.current_version?.published_at);

  const handleOpenSend = () => {
    setIsSendModalOpen(true);
    setSelectedMaterialId('');
    setCustomMessage('');
    setGeneratedShare(null);
  };

  const handleSend = () => {
    if (!selectedMaterialId) {
      toast.error('Selecione uma proposta para enviar');
      return;
    }
    
    // We override the materialId context here by calling a slightly modified mutate
    // Since useMaterialShares expects materialId in the hook, let's just use the api directly or 
    // a hook initialized with selectedMaterialId.
    // Wait, useMaterialShares takes materialId as a hook argument, so we need a dynamic approach.
    // I will just use the hook with selectedMaterialId.
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lunar-text">Orçamentos e Propostas</h3>
        <Button onClick={handleOpenSend} size="sm" variant="outline" className="gap-2">
          <Send className="h-4 w-4" />
          Enviar Orçamento
        </Button>
      </div>

      {isLoadingShares ? (
        <div className="py-4 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : shares.length === 0 ? (
        <div className="bg-lunar-surface border border-dashed border-lunar-border rounded-lg p-6 text-center text-sm text-lunar-textSecondary">
          Nenhum orçamento foi enviado para este lead ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {shares.map(share => (
            <div key={share.id} className="bg-lunar-surface border border-lunar-border rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-sm text-lunar-text">{share.material?.title || 'Proposta'}</h4>
                  <p className="text-xs text-lunar-textSecondary">
                    Enviado há {formatDistanceToNow(new Date(share.created_at), { locale: ptBR })}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs text-primary"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/p/${share.token}`);
                    toast.success('Link copiado!');
                  }}
                >
                  <Share2 className="h-3 w-3 mr-1" /> Copiar
                </Button>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-lunar-textSecondary bg-muted/30 p-2 rounded">
                <div className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  <span>{share.sessions?.length || 0} acessos</span>
                </div>
                {share.sessions && share.sessions.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      Último acesso: {formatDistanceToNow(new Date(share.sessions[0].created_at), { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <DynamicShareModal 
        isOpen={isSendModalOpen} 
        onClose={() => setIsSendModalOpen(false)}
        leadId={leadId}
        leadName={leadName}
        leadPhone={leadPhone}
        materials={activeMaterials}
      />
    </div>
  );
}

// Criado separado para poder injetar o selectedMaterialId no hook
function DynamicShareModal({ isOpen, onClose, leadId, leadName, leadPhone, materials }: any) {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');
  const [generatedShare, setGeneratedShare] = useState<any>(null);

  const { createShare } = useMaterialShares(selectedMaterialId || undefined);

  const handleSend = () => {
    if (!selectedMaterialId) {
      toast.error('Selecione uma proposta');
      return;
    }
    createShare.mutate({ lead_id: leadId, custom_message: customMessage }, {
      onSuccess: (data) => setGeneratedShare(data)
    });
  };

  // Reseta ao fechar
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setTimeout(() => {
        setSelectedMaterialId('');
        setCustomMessage('');
        setGeneratedShare(null);
      }, 300);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enviar Orçamento para {leadName.split(' ')[0]}</DialogTitle>
          <DialogDescription>
            Crie um link rastreável exclusivo para este cliente. A versão atual da proposta será travada para garantir integridade.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          {!generatedShare ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Proposta / Orçamento</label>
                <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um material publicado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.title}
                      </SelectItem>
                    ))}
                    {materials.length === 0 && (
                      <SelectItem value="none" disabled>Nenhuma proposta publicada</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Mensagem Personalizada (Opcional)</label>
                <Textarea 
                  placeholder="Deixe uma mensagem que será exibida no início da proposta..."
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col items-center justify-center text-center gap-2">
                <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center mb-1">
                  <Sparkles className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-green-800">Orçamento gerado!</h3>
                <p className="text-sm text-green-700 mb-4">
                  Copie o link abaixo ou envie diretamente via WhatsApp.
                </p>
                
                <div className="flex w-full flex-col gap-2">
                  <div className="flex w-full items-center gap-2">
                    <Input 
                      readOnly 
                      value={`${window.location.origin}/p/${generatedShare.token}`} 
                      className="bg-white border-green-200 text-sm h-10"
                    />
                    <Button 
                      variant="secondary"
                      className="shrink-0 bg-white hover:bg-green-100 text-green-700 border-green-200"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/p/${generatedShare.token}`);
                        toast.success('Link copiado!');
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                  {leadPhone && (
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        const phone = leadPhone.replace(/\D/g, '');
                        const msg = encodeURIComponent(`Olá ${leadName.split(' ')[0]}, preparei uma proposta exclusiva para você! Acesse o link: ${window.location.origin}/p/${generatedShare.token}`);
                        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                      }}
                    >
                      Enviar pelo WhatsApp
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {!generatedShare ? (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button 
                onClick={handleSend} 
                disabled={createShare.isPending || !selectedMaterialId}
                className="gap-2"
              >
                {createShare.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Gerar Link
              </Button>
            </>
          ) : (
            <Button onClick={() => handleOpenChange(false)} className="w-full">
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
