import { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useUserProfile, useUserBranding } from '@/hooks/useUserProfile';
import { useFormValidation } from '@/hooks/user-profile/useFormValidation';
import { PersonalInfoForm } from '@/components/user-profile/forms/PersonalInfoForm';
import { ContactInfoSection } from '@/components/user-profile/forms/ContactInfoSection';
import { LogoUploadSection } from '@/components/user-profile/upload/LogoUploadSection';
import { UserProfile } from '@/types/userProfile';
import { toast } from 'sonner';
export default function MinhaConta() {
  const { profile, saveProfile, getProfileOrDefault } = useUserProfile();
  const { branding, saveBranding, removeLogo, getBrandingOrDefault } = useUserBranding();
  
  const [formData, setFormData] = useState<Partial<UserProfile>>(() => getProfileOrDefault());
  
  // Validação em tempo real
  const validation = useFormValidation(formData);
  
  // Sincronizar formData quando profile carrega
  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);
  const handleInputChange = useCallback((field: keyof UserProfile, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleTelefonesChange = useCallback((telefones: string[]) => {
    setFormData(prev => ({ ...prev, telefones }));
  }, []);

  const handleSitesChange = useCallback((siteRedesSociais: string[]) => {
    setFormData(prev => ({ ...prev, siteRedesSociais }));
  }, []);
  const handleSaveProfile = useCallback(async () => {
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError);
      return;
    }

    // Garantir que campos obrigatórios estão presentes
    if (!formData.nomeCompleto?.trim()) {
      toast.error('Nome completo é obrigatório');
      return;
    }

    // Filtrar telefones e redes sociais vazios
    const cleanedData = {
      nomeCompleto: formData.nomeCompleto.trim(),
      nomeEmpresa: formData.nomeEmpresa || '',
      cpfCnpj: formData.cpfCnpj || '',
      emailPrincipal: formData.emailPrincipal || '',
      enderecoComercial: formData.enderecoComercial || '',
      telefones: (formData.telefones || []).filter(tel => tel.trim() !== ''),
      siteRedesSociais: (formData.siteRedesSociais || []).filter(site => site.trim() !== '')
    };
    
    await saveProfile(cleanedData);
  }, [formData, validation, saveProfile]);
  const handleLogoSave = useCallback((logoUrl: string, fileName: string) => {
    saveBranding({ logoUrl, logoFileName: fileName });
    toast.success('Logo salvo com sucesso!');
  }, [saveBranding]);

  const handleLogoRemove = useCallback(() => {
    removeLogo();
  }, [removeLogo]);
  return <div className="min-h-screen bg-lunar-bg">
      <ScrollArea className="h-screen">
        <div className="container mx-auto p-4 max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-lunar-text mb-2">Minha Conta</h1>
            <p className="text-lunar-textSecondary">Gerencie suas informações pessoais e da empresa</p>
          </div>

          <Card className="mb-6">
            <CardContent className="p-6">
              <Tabs defaultValue="perfil" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="perfil">Perfil</TabsTrigger>
                  <TabsTrigger value="marca">Marca</TabsTrigger>
                </TabsList>

                <TabsContent value="perfil" className="space-y-6 mt-6">
                  <PersonalInfoForm
                    formData={formData}
                    onChange={handleInputChange}
                    errors={validation.errors}
                  />
                  
                  <ContactInfoSection
                    telefones={formData.telefones || []}
                    siteRedesSociais={formData.siteRedesSociais || []}
                    onTelefonesChange={handleTelefonesChange}
                    onSitesChange={handleSitesChange}
                  />

                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={handleSaveProfile}
                      disabled={!validation.isValid}
                    >
                      Salvar Perfil
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="marca" className="space-y-6 mt-6">
                  <LogoUploadSection
                    logoUrl={getBrandingOrDefault().logoUrl}
                    logoFileName={getBrandingOrDefault().logoFileName}
                    onLogoSave={handleLogoSave}
                    onLogoRemove={handleLogoRemove}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>;
}