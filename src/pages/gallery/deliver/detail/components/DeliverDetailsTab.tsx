import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ExternalLink, Lock, Unlock, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DeliverDetailsTabProps {
  gallery: any;
  effectiveClienteId?: string | null;
  sessionName: string;
  setSessionName: (val: string) => void;
  subtitle: string;
  setSubtitle: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  eventDate: Date | undefined;
  setEventDate: (date: Date | undefined) => void;
  internalNotes: string;
  setInternalNotes: (notes: string) => void;
  isPrivate: boolean;
  setIsPrivate: (isPriv: boolean) => void;
  galleryPassword: string;
  setGalleryPassword: (pw: string) => void;
  expirationDate: Date | undefined;
  setExpirationDate: (date: Date | undefined) => void;
  welcomeEnabled: boolean;
  setWelcomeEnabled: (enabled: boolean) => void;
  welcomeMessage: string;
  setWelcomeMessage: (msg: string) => void;
}

export function DeliverDetailsTab({
  gallery,
  effectiveClienteId,
  sessionName,
  setSessionName,
  subtitle,
  setSubtitle,
  category,
  setCategory,
  eventDate,
  setEventDate,
  internalNotes,
  setInternalNotes,
  isPrivate,
  setIsPrivate,
  galleryPassword,
  setGalleryPassword,
  expirationDate,
  setExpirationDate,
  welcomeEnabled,
  setWelcomeEnabled,
  welcomeMessage,
  setWelcomeMessage,
}: DeliverDetailsTabProps) {
  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Coluna Esquerda: Identificação da Sessão & Cliente */}
        <div className="space-y-5 p-5 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="space-y-2">
            <Label htmlFor="sessionName" className="font-semibold text-sm">
              Nome da sessão
            </Label>
            <Input id="sessionName" value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="subtitle" className="text-xs font-medium text-muted-foreground">
                Subtítulo da Capa
              </Label>
              <Input
                id="subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Ex: Wedding Story"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs font-medium text-muted-foreground">
                Categoria / Tag
              </Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: WEDDING"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5 text-[#cbb384]" />
                Data do Evento
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'w-full justify-start text-left font-normal border-border/60 hover:border-[#cbb384]/50 h-9 text-xs',
                      !eventDate && 'text-muted-foreground'
                    )}
                  >
                    {eventDate ? format(eventDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl shadow-lg border border-border/60" align="start">
                  <Calendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</h4>
            <div className="space-y-1 text-sm bg-muted/40 p-3 rounded-lg border border-border/40">
              <div>
                {effectiveClienteId ? (
                  <Link
                    to={`/app/clientes/${effectiveClienteId}`}
                    className="font-medium text-primary hover:underline inline-flex items-center gap-1 group"
                    title="Ver perfil do cliente no CRM"
                  >
                    <span>{gallery.clienteNome || 'Sem cliente'}</span>
                    <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{gallery.clienteNome || 'Sem cliente'}</span>
                )}
              </div>
              <div className="text-muted-foreground text-xs">{gallery.clienteEmail || 'Sem e-mail cadastrado'}</div>
              <div className="text-muted-foreground text-xs">{gallery.clienteTelefone || 'Sem telefone cadastrado'}</div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="internalNotes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Observações internas
            </Label>
            <Textarea
              id="internalNotes"
              placeholder="Anotações privadas sobre esta entrega..."
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
            <p className="text-[11px] text-muted-foreground">Visíveis apenas para você.</p>
          </div>
        </div>

        {/* Coluna Direita: Acesso, Expiração & Configurações */}
        <div className="space-y-5 p-5 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPrivate ? <Lock className="h-4 w-4 text-amber-500" /> : <Unlock className="h-4 w-4 text-emerald-500" />}
                <div>
                  <span className="text-sm font-semibold">{isPrivate ? 'Privada (com senha)' : 'Pública'}</span>
                  <p className="text-xs text-muted-foreground">
                    {isPrivate ? 'Exige senha para visualização e download' : 'Qualquer pessoa com o link pode acessar'}
                  </p>
                </div>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>
            {isPrivate && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="password" className="text-xs font-medium">
                  Senha de acesso
                </Label>
                <Input
                  id="password"
                  type="text"
                  value={galleryPassword}
                  onChange={(e) => setGalleryPassword(e.target.value)}
                  placeholder="Digite a senha da galeria"
                />
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold">Data de expiração</span>
                <p className="text-xs text-muted-foreground">Prazo limite para o cliente baixar os arquivos</p>
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-xs">
                      <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                      {expirationDate ? format(expirationDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Definir data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl shadow-lg border border-border/60" align="end">
                    <Calendar mode="single" selected={expirationDate} onSelect={setExpirationDate} initialFocus />
                  </PopoverContent>
                </Popover>
                {expirationDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:text-destructive h-8 px-2"
                    onClick={() => setExpirationDate(undefined)}
                  >
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold">Mensagem de boas-vindas</span>
                <p className="text-xs text-muted-foreground">Exibida em modal ao cliente ao abrir a galeria</p>
              </div>
              <Switch
                checked={welcomeEnabled}
                onCheckedChange={(checked) => {
                  setWelcomeEnabled(checked);
                  if (!checked) setWelcomeMessage('');
                }}
              />
            </div>
            {welcomeEnabled && (
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Olá! Suas fotos estão prontas..."
                rows={4}
                className="text-sm resize-none"
              />
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
            <div>
              <span className="text-sm font-semibold">Download</span>
              <p className="text-xs text-muted-foreground">Download em alta resolução sempre ativo para entregas</p>
            </div>
            <Badge variant="secondary" className="gap-1.5 text-xs font-normal">
              <Download className="h-3.5 w-3.5 text-emerald-500" />
              Ativo
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
