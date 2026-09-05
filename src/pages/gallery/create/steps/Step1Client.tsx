import { Globe, Lock, Link2, Plus, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ClientSelect } from '@/components/ClientSelect';
import { ClientModal, ClientFormData } from '@/components/ClientModal';
import { PackageSelect } from '@/components/PackageSelect';
import { FontSelect } from '@/components/FontSelect';
import { cn } from '@/lib/utils';
import { GalleryPermission, Client, TitleCaseMode } from '@/types/gallery';
import { GestaoPackage } from '@/hooks/useGestaoPackages';

export interface Step1ClientProps {
  galleryPermission: GalleryPermission;
  setGalleryPermission: (v: GalleryPermission) => void;
  isAssistedMode: boolean;
  hasGestaoSession: boolean;
  gestaoParams: any;
  clients: Client[];
  isLoadingClients: boolean;
  selectedClient: Client | null;
  handleClientSelect: (client: Client | null) => void;
  isClientModalOpen: boolean;
  setIsClientModalOpen: (open: boolean) => void;
  handleSaveClient: (clientData: ClientFormData) => Promise<void>;
  passwordDisabled: boolean;
  setPasswordDisabled: (disabled: boolean) => void;
  useExistingPassword: boolean;
  setUseExistingPassword: (use: boolean) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  savePasswordToClient: boolean;
  setSavePasswordToClient: (save: boolean) => void;
  sessionName: string;
  setSessionName: (name: string) => void;
  onSessionNameTouched?: () => void;
  packageName: string;
  setPackageName: (name: string) => void;
  onPackageNameTouched?: () => void;
  hasGestaoIntegration: boolean;
  gestaoPackages: GestaoPackage[];
  isLoadingPackages: boolean;
  setIncludedPhotos: (photos: number) => void;
  setFixedPrice: (price: number) => void;
  includedPhotos: number;
  customDays: number;
  setCustomDays: (days: number) => void;
  settings: any;
  sessionFont: string;
  setSessionFont: (font: string) => void;
  titleCaseMode: TitleCaseMode;
  setTitleCaseMode: (mode: TitleCaseMode) => void;
  onTypographyTouched?: () => void;
}

export function Step1Client({
  galleryPermission,
  setGalleryPermission,
  isAssistedMode,
  hasGestaoSession,
  gestaoParams,
  clients,
  isLoadingClients,
  selectedClient,
  handleClientSelect,
  isClientModalOpen,
  setIsClientModalOpen,
  handleSaveClient,
  passwordDisabled,
  setPasswordDisabled,
  useExistingPassword,
  setUseExistingPassword,
  newPassword,
  setNewPassword,
  savePasswordToClient,
  setSavePasswordToClient,
  sessionName,
  setSessionName,
  onSessionNameTouched,
  packageName,
  setPackageName,
  onPackageNameTouched,
  hasGestaoIntegration,
  gestaoPackages,
  isLoadingPackages,
  setIncludedPhotos,
  setFixedPrice,
  includedPhotos,
  customDays,
  setCustomDays,
  settings,
  sessionFont,
  setSessionFont,
  titleCaseMode,
  setTitleCaseMode,
  onTypographyTouched,
}: Step1ClientProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Identificação e Acesso</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Dados do cliente e detalhes da sessão
          </p>
        </div>
        {/* Assisted Mode Badge */}
        {isAssistedMode && (
          <Badge
            variant="secondary"
            className="gap-1.5 bg-[#ddd1b6]/50 text-[#7a6035] dark:text-[#e4d5b7] border border-[#cbb384]/30 font-medium"
          >
            <Link2 className="h-3 w-3 text-[#cbb384]" />
            Vinculada à sessão do Studio
          </Badge>
        )}
      </div>

      {/* Gallery Permission */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">Permissão da Galeria</Label>
        <RadioGroup
          value={galleryPermission}
          onValueChange={(v) => {
            setGalleryPermission(v as GalleryPermission);
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
                <p className="text-xs text-muted-foreground">Sem senha · Acesso direto</p>
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
                <p className="text-xs text-muted-foreground">Requer senha de acesso</p>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Client Section - Only show for private galleries */}
      {galleryPermission === 'private' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-2">
              <Label>Cliente *</Label>
              {isLoadingClients ? (
                <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
              ) : (
                <ClientSelect
                  clients={clients}
                  selectedClient={selectedClient}
                  onSelect={handleClientSelect}
                  onCreateNew={() => setIsClientModalOpen(true)}
                />
              )}
            </div>
            <div className="pt-6">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsClientModalOpen(true)}
                disabled={isLoadingClients}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Password Section */}
          {selectedClient && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2 animate-fade-in">
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-medium">{selectedClient.email}</span>
                </div>
                {selectedClient.phone && (
                  <div>
                    <span className="text-muted-foreground">Telefone: </span>
                    <span className="font-medium">{selectedClient.phone}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 space-y-3">
                <Label className="text-sm">Senha de acesso à galeria</Label>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="passwordDisabled"
                    checked={passwordDisabled}
                    onCheckedChange={(checked) => {
                      setPasswordDisabled(checked as boolean);
                      if (checked) {
                        setUseExistingPassword(false);
                        setNewPassword('');
                      }
                    }}
                  />
                  <label htmlFor="passwordDisabled" className="text-sm font-medium leading-none">
                    Sem proteção por senha
                  </label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Qualquer pessoa com o link poderá acessar a galeria
                </p>

                {!passwordDisabled && (
                  <>
                    {selectedClient.galleryPassword ? (
                      <>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="useExisting"
                            checked={useExistingPassword}
                            onCheckedChange={(checked) => setUseExistingPassword(checked as boolean)}
                          />
                          <label htmlFor="useExisting" className="text-sm font-medium leading-none">
                            Usar senha cadastrada
                          </label>
                        </div>

                        {useExistingPassword && (
                          <div className="flex items-center gap-2 p-2 bg-muted rounded-md ml-6">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm">{selectedClient.galleryPassword}</span>
                          </div>
                        )}

                        {!useExistingPassword && (
                          <div className="space-y-2 ml-6">
                            <Input
                              placeholder="Nova senha para esta galeria"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="saveToClient"
                                checked={savePasswordToClient}
                                onCheckedChange={(checked) =>
                                  setSavePasswordToClient(checked as boolean)
                                }
                              />
                              <label htmlFor="saveToClient" className="text-xs text-muted-foreground">
                                Salvar esta senha no cadastro do cliente
                              </label>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Este cliente não possui senha cadastrada
                        </p>
                        <Input
                          placeholder="Definir senha para a galeria"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="saveToClient"
                            checked={savePasswordToClient}
                            onCheckedChange={(checked) =>
                              setSavePasswordToClient(checked as boolean)
                            }
                          />
                          <label htmlFor="saveToClient" className="text-xs text-muted-foreground">
                            Salvar esta senha no cadastro do cliente
                          </label>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sessionName">Nome da Sessão *</Label>
          <Input
            id="sessionName"
            placeholder="Ex: Ensaio Gestante"
            value={sessionName}
            onChange={(e) => {
              onSessionNameTouched?.();
              setSessionName(e.target.value);
            }}
          />
          {hasGestaoSession && (
            <p className="text-xs text-muted-foreground">
              Defina um nome para esta sessão
              {gestaoParams?.pacote_categoria
                ? ` (sugestão: ${gestaoParams.pacote_categoria}${
                    selectedClient?.name ? ` — ${selectedClient.name}` : ''
                  })`
                : ''}
              .
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="packageName">Pacote</Label>
          {hasGestaoIntegration && gestaoPackages.length > 0 ? (
            <PackageSelect
              packages={gestaoPackages}
              selectedPackage={packageName}
              onSelect={(name, pkg) => {
                onPackageNameTouched?.();
                setPackageName(name);
                if (pkg?.fotosIncluidas) {
                  setIncludedPhotos(pkg.fotosIncluidas);
                }
                if (pkg?.valorFotoExtra) {
                  setFixedPrice(pkg.valorFotoExtra);
                }
              }}
              disabled={isLoadingPackages}
            />
          ) : (
            <Input
              id="packageName"
              placeholder="Ex: Pacote Premium"
              value={packageName}
              onChange={(e) => {
                onPackageNameTouched?.();
                setPackageName(e.target.value);
              }}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="includedPhotos">Fotos Incluídas no Pacote *</Label>
          <Input
            id="includedPhotos"
            type="number"
            min={1}
            value={includedPhotos}
            onChange={(e) =>
              setIncludedPhotos(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)
            }
            className="max-w-[200px]"
          />
        </div>

        {/* Deadline */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <Label>Prazo de Seleção *</Label>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={90}
              value={customDays || ''}
              onChange={(e) =>
                setCustomDays(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)
              }
              className="w-24"
            />
            <span className="text-muted-foreground">dias</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Padrão: {settings.defaultExpirationDays || 10} dias
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Fonte do Título</Label>
        <FontSelect
          value={sessionFont}
          onChange={(font) => {
            onTypographyTouched?.();
            setSessionFont(font);
          }}
          previewText={sessionName || 'Ensaio Gestante'}
          titleCaseMode={titleCaseMode}
          onTitleCaseModeChange={(mode) => {
            onTypographyTouched?.();
            setTitleCaseMode(mode);
          }}
        />
      </div>

      <ClientModal
        open={isClientModalOpen}
        onOpenChange={setIsClientModalOpen}
        onSave={handleSaveClient}
      />
    </div>
  );
}
