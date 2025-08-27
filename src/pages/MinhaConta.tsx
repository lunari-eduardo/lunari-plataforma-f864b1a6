import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Plus, X, Upload, Trash2 } from 'lucide-react';
import { useUserProfile, useUserBranding } from '@/hooks/useUserProfile';
import { useRegimeTributario } from '@/hooks/useRegimeTributario';
import { formatCpfCnpj, validateEmail, validateCpfCnpj, formatPhone } from '@/utils/userUtils';
import { toast } from 'sonner';
export default function MinhaConta() {
  const {
    profile,
    saveProfile,
    getProfileOrDefault
  } = useUserProfile();
  const {
    branding,
    saveBranding,
    removeLogo,
    getBrandingOrDefault
  } = useUserBranding();
  const {
    regime,
    isMEI,
    isSimples,
    updateRegime
  } = useRegimeTributario();

  // Estados do formulário
  const [formData, setFormData] = useState(getProfileOrDefault());
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);
  useEffect(() => {
    const brandingData = getBrandingOrDefault();
    if (brandingData.logoUrl) {
      setLogoPreview(brandingData.logoUrl);
    }
  }, [branding]);
  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleCpfCnpjChange = (value: string) => {
    const formatted = formatCpfCnpj(value);
    handleInputChange('cpfCnpj', formatted);
  };
  const addToList = (field: 'telefones' | 'siteRedesSociais') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };
  const updateListItem = (field: 'telefones' | 'siteRedesSociais', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };
  const removeFromList = (field: 'telefones' | 'siteRedesSociais', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };
  const handleSaveProfile = () => {
    // Validações básicas
    if (!formData.nomeCompleto.trim()) {
      toast.error('Nome completo é obrigatório');
      return;
    }
    if (formData.emailPrincipal && !validateEmail(formData.emailPrincipal)) {
      toast.error('E-mail inválido');
      return;
    }
    if (formData.cpfCnpj && !validateCpfCnpj(formData.cpfCnpj)) {
      toast.error('CPF/CNPJ inválido');
      return;
    }

    // Filtrar telefones e redes sociais vazios
    const cleanedData = {
      ...formData,
      telefones: formData.telefones.filter(tel => tel.trim() !== ''),
      siteRedesSociais: formData.siteRedesSociais.filter(site => site.trim() !== '')
    };
    saveProfile(cleanedData);
  };
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const logoUrl = e.target?.result as string;
      setLogoPreview(logoUrl);
      saveBranding({
        logoUrl,
        logoFileName: file.name
      });
      toast.success('Logo salvo com sucesso!');
    };
    reader.readAsDataURL(file);
  };
  const handleRemoveLogo = () => {
    setLogoPreview(null);
    removeLogo();
  };
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
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="perfil">Perfil</TabsTrigger>
                  <TabsTrigger value="marca">Marca</TabsTrigger>
                  <TabsTrigger value="regime">Regime Tributário</TabsTrigger>
                </TabsList>

                <TabsContent value="perfil" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nomeCompleto">Nome Completo *</Label>
                        <Input id="nomeCompleto" value={formData.nomeCompleto} onChange={e => handleInputChange('nomeCompleto', e.target.value)} placeholder="Seu nome completo" />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="nomeEmpresa">Nome da Empresa (Fantasia)</Label>
                        <Input id="nomeEmpresa" value={formData.nomeEmpresa} onChange={e => handleInputChange('nomeEmpresa', e.target.value)} placeholder="Nome fantasia da empresa" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
                      <Input id="cpfCnpj" value={formData.cpfCnpj} onChange={e => handleCpfCnpjChange(e.target.value)} placeholder="000.000.000-00 ou 00.000.000/0000-00" maxLength={18} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="emailPrincipal">E-mail Principal de Contato</Label>
                      <Input id="emailPrincipal" type="email" value={formData.emailPrincipal} onChange={e => handleInputChange('emailPrincipal', e.target.value)} placeholder="seu@email.com" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="enderecoComercial">Endereço Comercial</Label>
                      <Textarea id="enderecoComercial" value={formData.enderecoComercial} onChange={e => handleInputChange('enderecoComercial', e.target.value)} placeholder="Endereço completo do estúdio/escritório" rows={3} />
                    </div>

                    <Separator />

                    {/* Telefones */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>WhatsApp</Label>
                        <Button type="button" variant="outline" size="sm" onClick={() => addToList('telefones')}>
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                      
                      {formData.telefones.map((telefone, index) => <div key={index} className="flex gap-2">
                          <Input value={telefone} onChange={e => updateListItem('telefones', index, formatPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
                          <Button type="button" variant="outline" size="icon" onClick={() => removeFromList('telefones', index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>)}
                      
                      {formData.telefones.length === 0 && <p className="text-sm text-lunar-textSecondary">Nenhum telefone adicionado</p>}
                    </div>

                    <Separator />

                    {/* Site e Redes Sociais */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Site / Redes Sociais</Label>
                        <Button type="button" variant="outline" size="sm" onClick={() => addToList('siteRedesSociais')}>
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                      
                      {formData.siteRedesSociais.map((site, index) => <div key={index} className="flex gap-2">
                          <Input value={site} onChange={e => updateListItem('siteRedesSociais', index, e.target.value)} placeholder="https://www.exemplo.com ou @usuario" />
                          <Button type="button" variant="outline" size="icon" onClick={() => removeFromList('siteRedesSociais', index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>)}
                      
                      {formData.siteRedesSociais.length === 0 && <p className="text-sm text-lunar-textSecondary">Nenhum link adicionado</p>}
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button onClick={handleSaveProfile}>
                        Salvar Perfil
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="marca" className="space-y-6 mt-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Logotipo da Empresa</h3>
                      <p className="text-sm text-lunar-textSecondary mb-4">
                        Adicione o logotipo da sua empresa. Recomendamos imagens em formato PNG ou JPG com fundo transparente.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {logoPreview ? <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                              <div className="w-20 h-20 bg-lunar-surface rounded-lg flex items-center justify-center overflow-hidden">
                                <img src={logoPreview} alt="Logo da empresa" className="max-w-full max-h-full object-contain" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">Logo atual</p>
                                <p className="text-sm text-lunar-textSecondary">
                                  {getBrandingOrDefault().logoFileName || 'Arquivo enviado'}
                                </p>
                              </div>
                              <Button variant="outline" size="sm" onClick={handleRemoveLogo}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remover
                              </Button>
                            </div>
                          </CardContent>
                        </Card> : <div className="border-2 border-dashed border-lunar-border rounded-lg p-8 text-center">
                          <Upload className="h-12 w-12 text-lunar-textSecondary mx-auto mb-4" />
                          <p className="text-lunar-textSecondary mb-4">Nenhum logo enviado</p>
                        </div>}

                      <div className="flex justify-center">
                        <label htmlFor="logo-upload">
                          <Button variant="outline" asChild>
                            <span className="cursor-pointer">
                              <Upload className="h-4 w-4 mr-2" />
                              {logoPreview ? 'Trocar Logo' : 'Enviar Logo'}
                            </span>
                          </Button>
                        </label>
                        <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </div>

                      <div className="text-xs text-lunar-textSecondary space-y-1">
                        <p>• Formatos aceitos: PNG, JPG, JPEG</p>
                        <p>• Tamanho máximo: 5MB</p>
                        <p>• Recomendado: 512x512px ou superior</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="regime" className="space-y-6 mt-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Regime Tributário</h3>
                      <p className="text-sm text-lunar-textSecondary mb-4">
                        Selecione o regime tributário da sua empresa. Esta configuração determina quais funcionalidades financeiras estarão disponíveis.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className={`cursor-pointer transition-all duration-200 border-2 ${isMEI() ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                            onClick={() => updateRegime('mei')}>
                        <CardContent className="p-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border-2 ${isMEI() ? 'bg-primary border-primary' : 'border-border'}`} />
                              <h4 className="font-semibold">MEI</h4>
                            </div>
                            <p className="text-sm text-lunar-textSecondary">
                              Microempreendedor Individual. Ideal para fotógrafos autônomos com faturamento até R$ 81.000/ano.
                            </p>
                            <div className="text-xs text-lunar-textSecondary space-y-1">
                              <p>• Tributos simplificados</p>
                              <p>• Controle financeiro básico</p>
                              <p>• Sem necessidade de DRE complexo</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className={`cursor-pointer transition-all duration-200 border-2 ${isSimples() ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                            onClick={() => updateRegime('simples')}>
                        <CardContent className="p-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border-2 ${isSimples() ? 'bg-primary border-primary' : 'border-border'}`} />
                              <h4 className="font-semibold">Simples Nacional</h4>
                            </div>
                            <p className="text-sm text-lunar-textSecondary">
                              Para empresas com faturamento até R$ 4.8 milhões/ano. Permite gestão financeira completa.
                            </p>
                            <div className="text-xs text-lunar-textSecondary space-y-1">
                              <p>• DRE detalhado disponível</p>
                              <p>• Análises financeiras avançadas</p>
                              <p>• Controle de impostos completo</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="bg-lunar-surface/50 rounded-lg p-4">
                      <p className="text-sm text-lunar-text">
                        <strong>Regime atual:</strong> {isMEI() ? 'MEI (Microempreendedor Individual)' : 'Simples Nacional'}
                      </p>
                      <p className="text-xs text-lunar-textSecondary mt-1">
                        {isMEI() 
                          ? 'As funcionalidades de DRE estão ocultas para simplificar sua experiência.'
                          : 'Todas as funcionalidades financeiras estão disponíveis, incluindo DRE detalhado.'
                        }
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>;
}