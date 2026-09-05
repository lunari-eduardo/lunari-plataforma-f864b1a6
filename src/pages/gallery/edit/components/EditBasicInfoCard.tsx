import React from 'react';
import { Image, Eye, EyeOff, Copy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FontSelect } from '@/components/FontSelect';
import { PackageSelect } from '@/components/PackageSelect';
import { ClientSelect } from '@/components/ClientSelect';
import { Client, TitleCaseMode } from '@/types/gallery';

export interface EditBasicInfoCardProps {
  sessionFont: string;
  setSessionFont: (f: string) => void;
  nomeSessao: string;
  setNomeSessao: (n: string) => void;
  titleCaseMode: TitleCaseMode;
  setTitleCaseMode: (m: TitleCaseMode) => void;
  nomePacote: string;
  setNomePacote: (p: string) => void;
  hasGestaoIntegration: boolean;
  gestaoPackages: any[];
  setFotosIncluidas: (n: number) => void;
  setValorFotoExtra: (v: number) => void;
  isBillingLocked: boolean;
  clients: Client[];
  selectedClient: Client | null;
  handleClientSelect: (c: Client | null) => void;
  setIsClientModalOpen: (open: boolean) => void;
  clienteEmail: string;
  setClienteEmail: (e: string) => void;
  clienteTelefone: string;
  handlePhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  galleryPassword?: string;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  handleCopyPassword: () => void;
}

export function EditBasicInfoCard({
  sessionFont,
  setSessionFont,
  nomeSessao,
  setNomeSessao,
  titleCaseMode,
  setTitleCaseMode,
  nomePacote,
  setNomePacote,
  hasGestaoIntegration,
  gestaoPackages,
  setFotosIncluidas,
  setValorFotoExtra,
  isBillingLocked,
  clients,
  selectedClient,
  handleClientSelect,
  setIsClientModalOpen,
  clienteEmail,
  setClienteEmail,
  clienteTelefone,
  handlePhoneChange,
  galleryPassword,
  showPassword,
  setShowPassword,
  handleCopyPassword,
}: EditBasicInfoCardProps) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Informações da Galeria
        </CardTitle>
        <CardDescription>Dados básicos e configurações de preço</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Fonte do Título */}
        <div className="space-y-2">
          <Label>Fonte do Título</Label>
          <FontSelect
            value={sessionFont}
            onChange={setSessionFont}
            previewText={nomeSessao || 'Ensaio Gestante'}
            titleCaseMode={titleCaseMode}
            onTitleCaseModeChange={setTitleCaseMode}
          />
        </div>

        {/* Nome + Pacote */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nomeSessao">Nome da Sessão</Label>
            <Input
              id="nomeSessao"
              value={nomeSessao}
              onChange={(e) => setNomeSessao(e.target.value)}
              placeholder="Ex: Ensaio Família Silva"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nomePacote">Pacote (opcional)</Label>
            {hasGestaoIntegration && gestaoPackages.length > 0 ? (
              <PackageSelect
                packages={gestaoPackages}
                selectedPackage={nomePacote}
                onSelect={(name, pkg) => {
                  setNomePacote(name);
                  if (pkg) {
                    if (pkg.fotosIncluidas) setFotosIncluidas(pkg.fotosIncluidas);
                    if (pkg.valorFotoExtra) setValorFotoExtra(pkg.valorFotoExtra);
                  }
                }}
                placeholder="Selecionar pacote..."
                disabled={isBillingLocked}
              />
            ) : (
              <Input
                id="nomePacote"
                value={nomePacote}
                onChange={(e) => setNomePacote(e.target.value)}
                placeholder="Ex: Premium"
                disabled={isBillingLocked}
              />
            )}
          </div>
        </div>

        {/* Cliente */}
        <div className="space-y-2">
          <Label>Cliente</Label>
          <ClientSelect
            clients={clients}
            selectedClient={selectedClient}
            onSelect={handleClientSelect}
            onCreateNew={() => setIsClientModalOpen(true)}
          />
        </div>

        {/* Email + Telefone */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clienteEmail">Email do Cliente</Label>
            <Input
              id="clienteEmail"
              type="email"
              value={clienteEmail}
              onChange={(e) => setClienteEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clienteTelefone">Telefone</Label>
            <Input
              id="clienteTelefone"
              type="tel"
              value={clienteTelefone}
              onChange={handlePhoneChange}
              placeholder="(00) 00000-0000"
            />
            <p className="text-xs text-muted-foreground">
              Necessário para abrir a conversa direta com o cliente no WhatsApp.
            </p>
          </div>
        </div>

        {/* Senha da Galeria - Read Only */}
        <div className="space-y-2">
          <Label>Senha da Galeria</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={galleryPassword || ''}
                readOnly
                className="pr-10 bg-muted"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyPassword}
              disabled={!galleryPassword}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
