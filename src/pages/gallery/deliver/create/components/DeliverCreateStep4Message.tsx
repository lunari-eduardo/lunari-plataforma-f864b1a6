import { Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Client, GalleryPermission } from '@/types/gallery';

interface DeliverCreateStep4MessageProps {
  welcomeMessageEnabled: boolean;
  setWelcomeMessageEnabled: (enabled: boolean) => void;
  welcomeMessage: string;
  setWelcomeMessage: (msg: string) => void;
  sessionName: string;
  selectedClient: Client | null;
  galleryPermission: GalleryPermission;
  photoCount: number;
  uploadedPhotosCount: number;
}

export function DeliverCreateStep4Message({
  welcomeMessageEnabled,
  setWelcomeMessageEnabled,
  welcomeMessage,
  setWelcomeMessage,
  sessionName,
  selectedClient,
  galleryPermission,
  photoCount,
  uploadedPhotosCount,
}: DeliverCreateStep4MessageProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border/40 pb-4">
        <h2 className="text-lg font-semibold text-foreground">Mensagem e Finalização</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure a mensagem de compartilhamento para o cliente e revise os detalhes antes de publicar.
        </p>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/60">
        <div className="space-y-0.5">
          <Label htmlFor="welcome-toggle" className="text-sm font-semibold cursor-pointer">
            Mensagem de Boas-Vindas
          </Label>
          <p className="text-xs text-muted-foreground">Exibida na tela inicial ao cliente acessar a galeria</p>
        </div>
        <Switch
          id="welcome-toggle"
          checked={welcomeMessageEnabled}
          onCheckedChange={(checked) => {
            setWelcomeMessageEnabled(checked);
            if (!checked) setWelcomeMessage('');
          }}
        />
      </div>

      {welcomeMessageEnabled && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Texto da Mensagem</Label>
          <Textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Olá! Suas fotos finais estão prontas para download com máxima qualidade. Aproveite!"
            rows={6}
            className="min-h-[160px] rounded-xl"
          />
        </div>
      )}

      {/* Luxury Summary Card */}
      <div className="p-5 rounded-2xl border border-[#cbb384]/40 bg-[#ddd1b6]/10 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#cbb384]" />
            Resumo da Galeria
          </h3>
          <span className="text-[11px] font-semibold text-[#7a6035] dark:text-[#e4d5b7] bg-[#ddd1b6]/50 px-2.5 py-0.5 rounded-full border border-[#cbb384]/30">
            Pronta para Publicação
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm pt-1">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Sessão</span>
            <p className="font-semibold text-foreground truncate">{sessionName}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Cliente</span>
            <p className="font-semibold text-foreground truncate">{selectedClient?.name || 'Público'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Acesso</span>
            <p className="font-semibold text-foreground">{galleryPermission === 'public' ? 'Pública' : 'Privada'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Total de Fotos</span>
            <p className="font-semibold text-[#7a6035] dark:text-[#e4d5b7]">
              {photoCount || uploadedPhotosCount} fotos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
