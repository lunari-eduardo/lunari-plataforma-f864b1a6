import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, User, Image, Shield, ArrowRight } from 'lucide-react';
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
  icon: any;
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
  const [activeTab, setActiveTab] = useState('perfil');
  const { user } = useAuth();
  const { profile, saveProfile, getProfileOrDefault, uploadLogo, deleteLogo, loading: isLoading } = useUserProfile();
  const [formData, setFormData] = useState<Partial<UserProfile>>(() => getProfileOrDefault());
  const validation = useFormValidation(formData);

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
      toast.error(firstError);
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
      telefones: (formData.telefones || []).filter(tel => tel.trim() !== ''),
      site_redes_sociais: (formData.site_redes_sociais || []).filter(site => site.trim() !== '')
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
                onClick={setActiveTab}
                icon={User}
              />
              <SidebarItem 
                label="Identidade Visual" 
                value="marca" 
                active={activeTab === 'marca'} 
                onClick={setActiveTab}
                icon={Image}
              />
              <SidebarItem 
                label="Segurança e Acesso" 
                value="seguranca" 
                active={activeTab === 'seguranca'} 
                onClick={setActiveTab}
                icon={Shield}
              />
            </aside>

            {/* Conteúdo da Aba */}
            <main className="min-w-0">
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'perfil' && (
                  <div className="space-y-10">
                    <section>
                      <h3 className="text-[15px] font-semibold mb-4 text-foreground/90">Informações Básicas</h3>
                      <div className="glass-1 p-6 space-y-6">
                        <PersonalInfoForm
                          formData={formData}
                          onChange={handleInputChange}
                          errors={validation.errors}
                          userEmail={user?.email || ''}
                        />
                      </div>
                    </section>
                    
                    <section>
                      <h3 className="text-[15px] font-semibold mb-4 text-foreground/90">Canais de Contato</h3>
                      <div className="glass-1 p-6">
                        <ContactInfoSection
                          telefones={formData.telefones || []}
                          siteRedesSociais={formData.site_redes_sociais || []}
                          onTelefonesChange={(telefones) => setFormData(prev => ({ ...prev, telefones }))}
                          onSitesChange={(sites) => setFormData(prev => ({ ...prev, site_redes_sociais: sites }))}
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
                  <section>
                    <h3 className="text-[15px] font-semibold mb-4 text-foreground/90">Logotipo do Estúdio</h3>
                    <div className="glass-1 p-6">
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
                )}

                {activeTab === 'seguranca' && (
                  <div className="space-y-10">
                    <section>
                      <h3 className="text-[15px] font-semibold mb-4 text-foreground/90">Alterar Senha</h3>
                      <div className="glass-1 p-6">
                        <SecuritySection />
                      </div>
                    </section>

                    <section className="pt-6 border-t border-border/40">
                      <h3 className="text-[15px] font-semibold mb-1 text-destructive">Privacidade e Dados</h3>
                      <p className="text-xs text-muted-foreground mb-4">Gerencie a retenção de seus dados e o status de sua conta.</p>
                      <div className="glass-1 border-destructive/20 p-6">
                        <AccountDeletionFlow />
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </main>
          </div>
        </PageContainer>
      </ScrollArea>
    </div>
  );
}
