import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Globe, Lock, Shield, Calendar, Sparkles, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as UiCalendar } from '@/components/ui/calendar';
import { ClientSelect } from '@/components/ClientSelect';
import { Client, GalleryPermission } from '@/types/gallery';
import { cn } from '@/lib/utils';

interface DeliverCreateStep1DataProps {
  galleryPermission: GalleryPermission;
  setGalleryPermission: (perm: GalleryPermission) => void;
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
  clients: Client[];
  isLoadingClients: boolean;
  onOpenClientModal: () => void;
  galleryPassword: string;
  setGalleryPassword: (pw: string) => void;
  sessionName: string;
  setSessionName: (name: string) => void;
  expirationDays: number;
  setExpirationDays: (days: number) => void;
  subtitle: string;
  setSubtitle: (sub: string) => void;
  category: string;
  setCategory: (cat: string) => void;
  eventDate: Date | undefined;
  setEventDate: (date: Date | undefined) => void;
}

export function DeliverCreateStep1Data({
  galleryPermission,
  setGalleryPermission,
  selectedClient,
  setSelectedClient,
  clients,
  isLoadingClients,
  onOpenClientModal,
  galleryPassword,
  setGalleryPassword,
  sessionName,
  setSessionName,
  expirationDays,
  setExpirationDays,
  subtitle,
  setSubtitle,
  category,
  setCategory,
  eventDate,
  setEventDate,
}: DeliverCreateStep1DataProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border/40 pb-4">
        <h2 className="text-lg font-semibold text-foreground">Identificação e Acesso</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Defina o cliente, privacidade e dados essenciais da sessão.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#cbb384]" />
          Permissão da Galeria
        </Label>
        <RadioGroup
          value={galleryPermission}
          onValueChange={(v) => {
            setGalleryPermission(v as GalleryPermission);
            if (v === 'public') {
              setSelectedClient(null);
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div>
            <RadioGroupItem value="public" id="gallery-public" className="peer sr-only" />
            <Label
              htmlFor="gallery-public"
              className={cn(
                'flex items-center gap-3.5 p-4 rounded-xl border cursor-pointer transition-all duration-200',
                'hover:-translate-y-0.5 hover:shadow-md hover:border-[#cbb384]/50',
                galleryPermission === 'public'
                  ? 'border-[#cbb384] bg-[#ddd1b6]/20 ring-1 ring-[#cbb384]/30 shadow-sm'
                  : 'border-border/60 bg-card hover:bg-muted/30'
              )}
            >
              <div
                className={cn(
                  'p-2.5 rounded-lg transition-colors',
                  galleryPermission === 'public'
                    ? 'bg-[#ddd1b6]/50 dark:bg-[#ddd1b6]/15 text-[#cbb384]'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Pública</p>
                <p className="text-xs text-muted-foreground">Sem senha · Acesso direto via link</p>
              </div>
            </Label>
          </div>
          <div>
            <RadioGroupItem value="private" id="gallery-private" className="peer sr-only" />
            <Label
              htmlFor="gallery-private"
              className={cn(
                'flex items-center gap-3.5 p-4 rounded-xl border cursor-pointer transition-all duration-200',
                'hover:-translate-y-0.5 hover:shadow-md hover:border-[#cbb384]/50',
                galleryPermission === 'private'
                  ? 'border-[#cbb384] bg-[#ddd1b6]/20 ring-1 ring-[#cbb384]/30 shadow-sm'
                  : 'border-border/60 bg-card hover:bg-muted/30'
              )}
            >
              <div
                className={cn(
                  'p-2.5 rounded-lg transition-colors',
                  galleryPermission === 'private'
                    ? 'bg-[#ddd1b6]/50 dark:bg-[#ddd1b6]/15 text-[#cbb384]'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Privada</p>
                <p className="text-xs text-muted-foreground">Protegida por senha de segurança</p>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Client Section - Only show for private galleries */}
      {galleryPermission === 'private' && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-2">
              <Label className="text-sm font-medium">
                Cliente <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              {isLoadingClients ? (
                <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
              ) : (
                <ClientSelect
                  clients={clients}
                  selectedClient={selectedClient}
                  onSelect={setSelectedClient}
                  onCreateNew={onOpenClientModal}
                />
              )}
            </div>
            <div className="pt-6">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onOpenClientModal}
                disabled={isLoadingClients}
                className="hover:border-[#cbb384]/50"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Senha de acesso *</Label>
            <Input
              id="password"
              type="text"
              value={galleryPassword}
              onChange={(e) => setGalleryPassword(e.target.value)}
              placeholder="Defina uma senha para o cliente"
            />
          </div>
        </div>
      )}

      {/* Session Name + Expiration - 2 columns */}
      <div className="grid gap-4 md:grid-cols-2 pt-2">
        <div className="space-y-2">
          <Label htmlFor="sessionName">Nome da sessão *</Label>
          <Input
            id="sessionName"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Ex: Ensaio Editorial - Maria & Família"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiration" className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#cbb384]" />
            Prazo de expiração (dias)
          </Label>
          <Input
            id="expiration"
            type="number"
            min={1}
            max={365}
            value={expirationDays}
            onChange={(e) => setExpirationDays(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Disponível para download por {expirationDays} dias após a publicação
          </p>
        </div>
      </div>

      {/* Editorial & Capa Info */}
      <div className="space-y-4 pt-4 border-t border-border/40">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#cbb384]" />
            Apresentação Editorial da Capa
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Essas informações são exibidas com tipografia nobre na capa da galeria.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtítulo da Capa</Label>
            <Input
              id="subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Ex: Wedding Story"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria / Tag</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: WEDDING ou ENSAIO"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-[#cbb384]" />
              Data do Evento / Sessão
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal border-border/60 hover:border-[#cbb384]/50',
                    !eventDate && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4 text-[#cbb384]" />
                  {eventDate ? format(eventDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-xl shadow-lg border border-border/60" align="start">
                <UiCalendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
}
