import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import PlanosTab from '@/components/account/PlanosTab';
import ReferralsTab from '@/components/account/ReferralsTab';
import { Button } from '@/components/ui/button';
import { Loader2, User, Image, Shield, ArrowRight, LucideIcon, Package, Gift, Plug } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useFormValidation } from '@/hooks/user-profile/useFormValidation';
import { PersonalInfoForm } from '@/components/user-profile/forms/PersonalInfoForm';
import { ContactInfoSection } from '@/components/user-profile/forms/ContactInfoSection';
import { LogoUploadSection } from '@/components/user-profile/upload/LogoUploadSection';
import { SecuritySection } from '@/components/user-profile/forms/SecuritySection';
import { AccountDeletionFlow } from '@/components/user-profile/AccountDeletionFlow';
import { UserProfile } from '@/services/ProfileService';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
import { useGallerySettings } from '@/hooks/useGallerySettings';
import { FaviconUploader } from '@/components/settings/FaviconUploader';
import { IntegracoesTab } from '@/components/preferencias/IntegracoesTab';

const SidebarItem = memo(({ 
  label, 
  value, 
  active, 
  onClick, 
  icon: Icon 
}: { 
  label: string; 
  value: string; 
  active: boolean; 
  onClick: (val: string) => void;
  icon: LucideIcon;
}) => (
  <button
    onClick={() => onClick(value)}
    className={cn(
      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all group",
      active 
        ? "bg-primary text-primary-foreground font-medium shadow-sm" 
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
    )}
  >
    <div className="flex items-center gap-3">
      <Icon className={cn("w-4 h-4", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
      <span>{label}</span>
    </div>
    <ArrowRight className={cn("w-3.5 h-3.5 transition-transform", active ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0")} />
  </button>
));

export default function MinhaConta() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const hasMpCallback = !!searchParams.get('mp_callback');
  
  const initialTab = tabParam || (hasMpCallback ? 'integracoes' : 'perfil');
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (tabParam && ['perfil', 'marca', 'seguranca', 'integracoes', 'planos', 'indicacoes'].includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (hasMpCallback) {
      setActiveTab('integracoes');
    }
  }, [tabParam, hasMpCallback]);

  const handleTabChange = useCallback((val: string) => {
    setActiveTab(val);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', val);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const { user } = useAuth();
  const { profile, saveProfile, getProfileOrDefault, uploadLogo, deleteLogo, loading: isLoading } = useUserProfile();
  const [formData, setFormData] = useState<Partial<UserProfile>>(() => getProfileOrDefault());
  const validation = useFormValidation(formData);
  const { settings: gallerySettings, updateSettings: updateGallerySettings } = useGallerySettings();

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const handleInputChange = useCallback((field: keyof UserProfile, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError as string);
      return;
    }

    if (!formData.nome?.trim()) {
      toast.error('Nome completo é obrigatório');
      return;
    }

    const cleanedData = {
      nome: formData.nome.trim(),
      empresa: formData.empresa || null,
      cpf_cnpj: formData.cpf_cnpj || null,
      email: formData.email || null,
      endereco_comercial: formData.endereco_comercial || null,
      telefones: (formData.telefones || []).filter((tel: string) => tel.trim() !== ''),
      site_redes_sociais: (formData.site_redes_sociais || []).filter((site: string) => site.trim() !== '')
    };
    
    await saveProfile(cleanedData);
  }, [formData, validation, saveProfile]);

  const handleLogoSave = useCallback(async (file: File) => {
    try {
      await uploadLogo(file);
    } catch (error) {}
  }, [uploadLogo]);

  const handleLogoRemove = useCallback(async () => {
    try {
      await deleteLogo();
    } catch (error) {}
  }, [deleteLogo]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ScrollArea className="h-screen">
        <PageContainer className="py-8 max-w-5xl">
          <PageHeader
            title="Minha Conta"
            description="Configurações de perfil, segurança e dados da plataforma"
            className="mb-8"
          />

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-12">
            {/* Sidebar de Navegação Minimalista */}
            <aside className="space-y-1">
              <SidebarItem 
                label="Perfil Pessoal" 
                value="perfil" 
                active={activeTab === 'perfil'} 
                onClick={handleTabChange}
                icon={User}
              />
              <SidebarItem 
                label="Identidade Visual" 
                value="marca" 
                active={activeTab === 'marca'} 
                onClick={handleTabChange}
                icon={Image}
              />
              <SidebarItem 
                label="Segurança e Acesso" 
                value="seguranca" 
                active={activeTab === 'seguranca'} 
                onClick={handleTabChange}
                icon={Shield}
              />
              <SidebarItem 
                label="Integrações e Pagamentos" 
                value="integracoes" 
                active={activeTab === 'integracoes'} 
                onClick={handleTabChange}
                icon={Plug}
              />
              <SidebarItem 
                label="Planos e Créditos" 
                value="planos" 
                active={activeTab === 'planos'} 
                onClick={handleTabChange}
                icon={Package}
              />
              <SidebarItem 
                label="Indique e Ganhe" 
                value="indicacoes" 
                active={activeTab === 'indicacoes'} 
                onClick={handleTabChange}
                icon={Gift}
              />
            </aside>

            {/* Conteúdo da Aba */}
            <main className="min-w-0">
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'perfil' && (
                  <div className="space-y-10">
                    <section>
                      <h3 className="text-[15px] font-semibold mb-4 text-foreground/90 font-heading">Informações Básicas</h3>
                      <div className="glass-1 p-6 space-y-6 bg-card/40">
                        <PersonalInfoForm
                          formData={formData}
                          onChange={handleInputChange}
                          errors={validation.errors}
                          userEmail={user?.email || ''}
                        />
                      </div>
                    </section>
                    
                    <section>
                      <h3 className="text-[15px] font-semibold mb-4 text-foreground/90 font-heading">Canais de Contato</h3>
                      <div className="glass-1 p-6 bg-card/40">
                        <ContactInfoSection
                          telefones={formData.telefones || []}
                          siteRedesSociais={formData.site_redes_sociais || []}
                          onTelefonesChange={(telefones: string[]) => setFormData(prev => ({ ...prev, telefones }))}
                          onSitesChange={(sites: string[]) => setFormData(prev => ({ ...prev, site_redes_sociais: sites }))}
                        />
                      </div>
                    </section>

                    <div className="flex justify-end border-t border-border/40 pt-6">
                      <Button 
                        onClick={handleSaveProfile}
                        disabled={!validation.isValid}
                        className="px-8"
                      >
                        Salvar Alterações
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'marca' && (
                  <div className="space-y-10">
                    <section>
                      <h3 className="text-[15px] font-semibold mb-4 text-foreground/90 font-heading">Logotipo do Estúdio</h3>
                      <div className="glass-1 p-6 bg-card/40">
                        <LogoUploadSection
                          logoUrl={profile?.logo_url || undefined}
                          onLogoSave={handleLogoSave}
                          onLogoRemove={handleLogoRemove}
                        />
                        <p className="mt-4 text-xs text-muted-foreground">
                          Este logotipo será utilizado em galerias, contratos e links de cobrança enviados aos clientes.
                        </p>
                      </div>
                    </section>
                    <section>
                      <h3 className="text-[15px] font-semibold mb-4 text-foreground/90 font-heading">Favicon das Galerias</h3>
                      <div className="glass-1 p-6 bg-card/40">
                        <FaviconUploader
                          favicon={gallerySettings?.faviconUrl}
                          onFaviconChange={(favicon) => updateGallerySettings({ faviconUrl: favicon }, { successMessage: favicon ? 'Favicon atualizado.' : 'Favicon removido.' })}
                        />
                        <p className="mt-4 text-xs text-muted-foreground">
                          O ícone que aparece na aba do navegador quando clientes acessam suas galerias.
                        </p>
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'integracoes' && (
                  <div className="animate-fade-in pb-12">
                    <IntegracoesTab />
                  </div>
                )}

                {activeTab === 'seguranca' && (
                  <div className="space-y-10">
                    <section>
                      <h3 className="text-[15px] font-semibold mb-4 text-foreground/90 font-heading">Alterar Senha</h3>
                      <div className="glass-1 p-6 bg-card/40">
                        <SecuritySection />
                      </div>
                    </section>

                    <section className="pt-6 border-t border-border/40">
                      <h3 className="text-[15px] font-semibold mb-1 text-destructive font-heading">Privacidade e Dados</h3>
                      <p className="text-xs text-muted-foreground mb-4">Gerencie a retenção de seus dados e o status de sua conta.</p>
                      <div className="glass-1 border-destructive/20 p-6 bg-card/40">
                        <AccountDeletionFlow />
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'planos' && (
                  <PlanosTab />
                )}

                {activeTab === 'indicacoes' && (
                  <ReferralsTab />
                )}
              </div>
            </main>
          </div>
        </PageContainer>
      </ScrollArea>
    </div>
  );
}
