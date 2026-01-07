import { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useFormValidation } from '@/hooks/user-profile/useFormValidation';
import { PersonalInfoForm } from '@/components/user-profile/forms/PersonalInfoForm';
import { ContactInfoSection } from '@/components/user-profile/forms/ContactInfoSection';
import { LogoUploadSection } from '@/components/user-profile/upload/LogoUploadSection';
import { UserProfile } from '@/services/ProfileService';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Sync with retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export default function MinhaConta() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Ativando sua assinatura...');
  const syncAttemptedRef = useRef(false);
  
  const { user } = useAuth();
  const { profile, saveProfile, getProfileOrDefault, uploadLogo, deleteLogo } = useUserProfile();
  
  const [formData, setFormData] = useState<Partial<UserProfile>>(() => getProfileOrDefault());
  
  // Validação em tempo real
  const validation = useFormValidation(formData);

  // Sync with Stripe with retry logic
  const syncWithStripe = useCallback(async (retryCount = 0): Promise<boolean> => {
    try {
      setSyncMessage(retryCount > 0 
        ? `Tentativa ${retryCount + 1}/${MAX_RETRIES + 1}...` 
        : 'Ativando sua assinatura...');
      
      const { data, error } = await supabase.functions.invoke('sync-user-subscription');
      
      if (error) {
        console.error(`Sync error (attempt ${retryCount + 1}):`, error);
        
        // Retry with exponential backoff
        if (retryCount < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
          setSyncMessage(`Aguarde, tentando novamente em ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          return syncWithStripe(retryCount + 1);
        }
        
        toast.error('Erro ao sincronizar assinatura. Por favor, acesse "Minha Assinatura" para verificar.');
        return false;
      }
      
      if (data?.synced) {
        toast.success('Assinatura ativada com sucesso!');
        return true;
      } else if (data?.message) {
        // Handle specific messages from sync function
        toast.info(data.message);
        return true;
      } else {
        toast.success('Pagamento processado! Verificando ativação...');
        return true;
      }
    } catch (err) {
      console.error(`Sync exception (attempt ${retryCount + 1}):`, err);
      
      if (retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        await new Promise(r => setTimeout(r, delay));
        return syncWithStripe(retryCount + 1);
      }
      
      toast.error('Erro na sincronização. Verifique sua assinatura.');
      return false;
    }
  }, []);

  // Auto-sync com Stripe quando retornar do checkout
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    
    // Prevent duplicate sync attempts
    if (checkoutStatus === 'success' && !syncAttemptedRef.current) {
      syncAttemptedRef.current = true;
      
      // Limpar parâmetro da URL immediately
      setSearchParams({}, { replace: true });
      
      // Start sync process
      const runSync = async () => {
        setIsSyncing(true);
        
        try {
          const success = await syncWithStripe();
          
          // Always redirect to subscription page after sync
          setTimeout(() => {
            // Force a full page reload to refresh access state
            window.location.href = '/minha-assinatura';
          }, 1500);
        } finally {
          setIsSyncing(false);
        }
      };
      
      runSync();
    }
  }, [searchParams, setSearchParams, syncWithStripe]);
  
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
    if (!formData.nome?.trim()) {
      toast.error('Nome completo é obrigatório');
      return;
    }

    // Filtrar telefones e redes sociais vazios
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
    } catch (error) {
      // Error already handled in uploadLogo
    }
  }, [uploadLogo]);

  const handleLogoRemove = useCallback(async () => {
    try {
      await deleteLogo();
    } catch (error) {
      // Error already handled in deleteLogo
    }
  }, [deleteLogo]);

  // Loading overlay durante sincronização
  if (isSyncing) {
    return (
      <div className="min-h-screen bg-lunar-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">{syncMessage}</p>
          <p className="text-muted-foreground">Aguarde enquanto sincronizamos seu pagamento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lunar-bg">
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
                    userEmail={user?.email || ''}
                  />
                  
                  <ContactInfoSection
                    telefones={formData.telefones || []}
                    siteRedesSociais={formData.site_redes_sociais || []}
                    onTelefonesChange={(telefones) => setFormData(prev => ({ ...prev, telefones }))}
                    onSitesChange={(sites) => setFormData(prev => ({ ...prev, site_redes_sociais: sites }))}
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
                    logoUrl={getProfileOrDefault().logo_url || undefined}
                    onLogoSave={handleLogoSave}
                    onLogoRemove={handleLogoRemove}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
