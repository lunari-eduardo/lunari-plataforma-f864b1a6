import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, Phone, Mail, MapPin, Heart, MessageSquare, Baby, Plus, Users, Calendar 
} from "lucide-react";
import { InlineEditField } from '../shared/InlineEditField';
import { PhoneInputSmart } from '../shared/PhoneInputSmart';
import { OrigemVisualSelect } from '../shared/OrigemVisualSelect';
import { FamilyMiniCard } from '../shared/FamilyMiniCard';
import { ClienteCompleto } from '@/types/cliente-supabase';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface ContactoTabProps {
  cliente: ClienteCompleto;
  onUpdate: (id: string, data: any) => void;
}

const formatAge = (birthDate: string) => {
  if (!birthDate) return '';
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} anos`;
};

const getInitials = (nome: string) => {
  return nome
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export function ContactoTab({ cliente, onUpdate }: ContactoTabProps) {
  // Mapear família do Supabase para formato local
  const conjugeData = cliente.familia?.find(f => f.tipo === 'conjuge');
  const filhosData = cliente.familia?.filter(f => f.tipo === 'filho') || [];

  const [localFilhos, setLocalFilhos] = useState(filhosData.map(f => ({
    id: f.id,
    nome: f.nome || '',
    dataNascimento: f.data_nascimento || ''
  })));

  const [localConjuge, setLocalConjuge] = useState({
    nome: conjugeData?.nome || '',
    dataNascimento: conjugeData?.data_nascimento || ''
  });

  const [localObservacoes, setLocalObservacoes] = useState(cliente.observacoes || '');
  const [isSavingObs, setIsSavingObs] = useState(false);
  const obsDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync quando cliente muda
  useEffect(() => {
    const conjugeDataNew = cliente.familia?.find(f => f.tipo === 'conjuge');
    const filhosDataNew = cliente.familia?.filter(f => f.tipo === 'filho') || [];
    
    setLocalConjuge({
      nome: conjugeDataNew?.nome || '',
      dataNascimento: conjugeDataNew?.data_nascimento || ''
    });
    
    setLocalFilhos(filhosDataNew.map(f => ({
      id: f.id,
      nome: f.nome || '',
      dataNascimento: f.data_nascimento || ''
    })));

    setLocalObservacoes(cliente.observacoes || '');
  }, [cliente]);

  // Handler genérico para salvar um campo do cliente
  const handleSaveField = async (field: string, value: any) => {
    onUpdate(cliente.id, { [field]: value });
  };

  // Handler para salvar família completa
  const saveFamilia = (conjuge: typeof localConjuge, filhos: typeof localFilhos) => {
    const familiaData = {
      conjuge: {
        nome: conjuge.nome,
        dataNascimento: conjuge.dataNascimento
      },
      filhos: filhos.map(f => ({
        id: f.id,
        nome: f.nome,
        dataNascimento: f.dataNascimento
      }))
    };
    onUpdate(cliente.id, familiaData);
  };

  // Handlers para cônjuge
  const handleSaveConjugeNome = async (value: string) => {
    const newConjuge = { ...localConjuge, nome: value };
    setLocalConjuge(newConjuge);
    saveFamilia(newConjuge, localFilhos);
  };

  const handleSaveConjugeData = async (value: string) => {
    const newConjuge = { ...localConjuge, dataNascimento: value };
    setLocalConjuge(newConjuge);
    saveFamilia(newConjuge, localFilhos);
  };

  // Handlers para filhos
  const handleSaveFilhoNome = async (filhoId: string, value: string) => {
    const newFilhos = localFilhos.map(f => 
      f.id === filhoId ? { ...f, nome: value } : f
    );
    setLocalFilhos(newFilhos);
    saveFamilia(localConjuge, newFilhos);
  };

  const handleSaveFilhoData = async (filhoId: string, value: string) => {
    const newFilhos = localFilhos.map(f => 
      f.id === filhoId ? { ...f, dataNascimento: value } : f
    );
    setLocalFilhos(newFilhos);
    saveFamilia(localConjuge, newFilhos);
  };

  const handleAddFilho = () => {
    const newFilho = { id: `filho_${Date.now()}`, nome: '', dataNascimento: '' };
    const newFilhos = [...localFilhos, newFilho];
    setLocalFilhos(newFilhos);
    saveFamilia(localConjuge, newFilhos);
  };

  const handleRemoveFilho = async (filhoId: string) => {
    const newFilhos = localFilhos.filter(f => f.id !== filhoId);
    setLocalFilhos(newFilhos);
    saveFamilia(localConjuge, newFilhos);
  };

  // Handler para observações com debounce
  const handleObservacoesChange = (value: string) => {
    setLocalObservacoes(value);
    
    if (obsDebounceRef.current) {
      clearTimeout(obsDebounceRef.current);
    }
    
    obsDebounceRef.current = setTimeout(async () => {
      setIsSavingObs(true);
      try {
        onUpdate(cliente.id, { observacoes: value });
        toast.success('Salvo', { duration: 1500 });
      } finally {
        setIsSavingObs(false);
      }
    }, 800);
  };

  // Contadores para os headers
  const qtdFilhos = localFilhos.length;
  const temFamilia = localConjuge.nome || qtdFilhos > 0;

  return (
    <div className="space-y-4">
      {/* Card Principal com Avatar */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-background shadow-md">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {cliente.nome ? getInitials(cliente.nome) : <User className="h-6 w-6" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold truncate">{cliente.nome || 'Nome não informado'}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {cliente.data_nascimento && (
                  <Badge variant="secondary" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatAge(cliente.data_nascimento)}
                  </Badge>
                )}
                {cliente.origem && (
                  <Badge variant="outline" className="text-xs">
                    {cliente.origem}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Accordion com seções colapsáveis */}
      <Accordion 
        type="multiple" 
        defaultValue={["identificacao", "contato"]}
        className="space-y-2"
      >
        {/* SEÇÃO 1: Identificação */}
        <AccordionItem value="identificacao" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <span className="font-medium">Identificação</span>
                {cliente.data_nascimento && (
                  <span className="text-xs text-muted-foreground ml-2">
                    • {formatAge(cliente.data_nascimento)}
                  </span>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="grid gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome completo</label>
                <InlineEditField
                  value={cliente.nome}
                  onSave={async (v) => handleSaveField('nome', v)}
                  placeholder="Nome do cliente"
                  icon={<User className="h-4 w-4" />}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data de nascimento</label>
                <InlineEditField
                  value={cliente.data_nascimento || ''}
                  onSave={async (v) => handleSaveField('dataNascimento', v)}
                  type="date"
                  placeholder="Selecionar data"
                  icon={<Calendar className="h-4 w-4" />}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SEÇÃO 2: Contato */}
        <AccordionItem value="contato" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <Phone className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-left">
                <span className="font-medium">Contato</span>
                {(cliente.telefone || cliente.email) && (
                  <span className="text-xs text-muted-foreground ml-2">• Informado</span>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            {/* Telefone Inteligente */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
              <PhoneInputSmart
                value={cliente.telefone || ''}
                onSave={async (v) => handleSaveField('telefone', v)}
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">E-mail</label>
              <InlineEditField
                value={cliente.email || ''}
                onSave={async (v) => handleSaveField('email', v)}
                type="email"
                placeholder="cliente@exemplo.com"
                icon={<Mail className="h-4 w-4" />}
              />
            </div>

            {/* Endereço */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Endereço</label>
              <InlineEditField
                value={cliente.endereco || ''}
                onSave={async (v) => handleSaveField('endereco', v)}
                placeholder="Rua, número, bairro, cidade"
                icon={<MapPin className="h-4 w-4" />}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SEÇÃO 3: Como conheceu */}
        <AccordionItem value="origem" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-left">
                <span className="font-medium">Como conheceu?</span>
                {cliente.origem && (
                  <span className="text-xs text-muted-foreground ml-2">• {cliente.origem}</span>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <OrigemVisualSelect
              value={cliente.origem || ''}
              onSave={async (v) => handleSaveField('origem', v)}
            />
          </AccordionContent>
        </AccordionItem>

        {/* SEÇÃO 4: Família */}
        <AccordionItem value="familia" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                <Heart className="h-4 w-4 text-rose-600" />
              </div>
              <div className="text-left flex items-center gap-2">
                <span className="font-medium">Família</span>
                {temFamilia && (
                  <Badge variant="secondary" className="text-xs">
                    {qtdFilhos > 0 ? `${qtdFilhos} filho${qtdFilhos > 1 ? 's' : ''}` : 'Cônjuge'}
                  </Badge>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            {/* Cônjuge */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
                <Heart className="h-3 w-3" />
                Cônjuge
              </label>
              <FamilyMiniCard
                id="conjuge"
                nome={localConjuge.nome}
                dataNascimento={localConjuge.dataNascimento}
                tipo="conjuge"
                onSaveNome={handleSaveConjugeNome}
                onSaveData={handleSaveConjugeData}
              />
            </div>

            {/* Filhos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Baby className="h-3 w-3" />
                  Filhos
                  {qtdFilhos > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">{qtdFilhos}</Badge>
                  )}
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddFilho}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar filho
                </Button>
              </div>
              
              <div className="space-y-2">
                {localFilhos.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2 text-center">
                    Nenhum filho cadastrado
                  </p>
                ) : (
                  localFilhos.map((filho, index) => (
                    <FamilyMiniCard
                      key={filho.id}
                      id={filho.id}
                      nome={filho.nome}
                      dataNascimento={filho.dataNascimento}
                      tipo="filho"
                      index={index}
                      onSaveNome={(v) => handleSaveFilhoNome(filho.id, v)}
                      onSaveData={(v) => handleSaveFilhoData(filho.id, v)}
                      onRemove={() => handleRemoveFilho(filho.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SEÇÃO 5: Observações */}
        <AccordionItem value="observacoes" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-left">
                <span className="font-medium">Observações</span>
                {cliente.observacoes && (
                  <span className="text-xs text-muted-foreground ml-2">• Preenchido</span>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <Textarea
              value={localObservacoes}
              onChange={(e) => handleObservacoesChange(e.target.value)}
              placeholder="Anotações importantes sobre o cliente, preferências, histórico..."
              rows={4}
              className="resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {localObservacoes.length}/500 caracteres
              </p>
              {isSavingObs && (
                <p className="text-xs text-primary animate-pulse">Salvando...</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
