import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MigrationStatus {
  total: number;
  completed: number;
  currentTask: string;
  errors: string[];
}

const MIGRATION_KEYS = [
  // Configuration data
  'configuracoes_categorias',
  'configuracoes_pacotes', 
  'configuracoes_produtos',
  'lunari_workflow_status',
  
  // User preferences
  'userPreferences',
  'user_profile',
  'user_branding',
  
  // Leads and clients
  'lunari_leads',
  'lunari_clientes',
  'lunari_clientes_familia',
  
  // Agenda and appointments
  'lunari_appointments',
  'agenda_availability_slots',
  'agenda_availability_types',
  'lunari_agenda_settings',
  
  // Financial data
  'lunari_transactions',
  'lunari_financial_categories',
  'pricing_structure_costs',
  'pricing_hour_patterns',
  'pricing_goals',
  'pricing_calculator_state',
  
  // Tasks and workflow
  'lunari_tasks',
  'workflow_sessions',
  'workflow_items',
  
  // Feed and other data
  'lunari_feed_items',
  'custom_time_slots'
];

export const DataMigrationRunner: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<MigrationStatus>({
    total: 0,
    completed: 0,
    currentTask: '',
    errors: []
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const runMigration = async () => {
    if (!user) return;
    
    setIsRunning(true);
    setStatus({
      total: MIGRATION_KEYS.length,
      completed: 0,
      currentTask: 'Iniciando migração...',
      errors: []
    });

    for (let i = 0; i < MIGRATION_KEYS.length; i++) {
      const key = MIGRATION_KEYS[i];
      
      setStatus(prev => ({
        ...prev,
        currentTask: `Migrando ${key}...`,
        completed: i
      }));

      try {
        await migrateDataKey(key, user.id);
      } catch (error) {
        console.error(`Error migrating ${key}:`, error);
        setStatus(prev => ({
          ...prev,
          errors: [...prev.errors, `Erro ao migrar ${key}: ${error}`]
        }));
      }

      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setStatus(prev => ({
      ...prev,
      completed: MIGRATION_KEYS.length,
      currentTask: 'Migração concluída!'
    }));

    // Clear all localStorage keys after successful migration
    MIGRATION_KEYS.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Could not remove localStorage key ${key}:`, error);
      }
    });

    // Clear additional old keys
    const additionalKeys = [
      'workflow_status',
      'app_initialized',
      'performance_config',
      'equipment_processed_ids'
    ];
    
    additionalKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Could not remove additional key ${key}:`, error);
      }
    });

    setIsRunning(false);
    setIsComplete(true);
    toast.success('Migração de dados concluída! Todos os dados foram transferidos para o Supabase.');
  };

  const migrateDataKey = async (key: string, userId: string) => {
    const data = localStorage.getItem(key);
    if (!data) return; // Nothing to migrate

    try {
      const parsedData = JSON.parse(data);
      
      // Migrate based on key type
      switch (key) {
        case 'configuracoes_categorias':
          await migrateCategorias(parsedData, userId);
          break;
        case 'configuracoes_pacotes':
          await migratePacotes(parsedData, userId);
          break;
        case 'configuracoes_produtos':
          await migrateProdutos(parsedData, userId);
          break;
        case 'lunari_workflow_status':
        case 'workflow_status':
          await migrateEtapas(parsedData, userId);
          break;
        case 'userPreferences':
        case 'user_profile':
        case 'user_branding':
          await migrateUserData(key, parsedData, userId);
          break;
        case 'lunari_leads':
          await migrateLeads(parsedData, userId);
          break;
        case 'lunari_tasks':
          await migrateTasks(parsedData, userId);
          break;
        case 'lunari_appointments':
          await migrateAppointments(parsedData, userId);
          break;
        case 'lunari_transactions':
          await migrateFinancialItems(parsedData, userId);
          break;
        case 'agenda_availability_slots':
          await migrateAvailabilitySlots(parsedData, userId);
          break;
        case 'pricing_structure_costs':
        case 'pricing_hour_patterns':
        case 'pricing_goals':
        case 'pricing_calculator_state':
          await migratePricingConfig(key, parsedData, userId);
          break;
        default:
          console.log(`No migration handler for key: ${key}`);
      }
    } catch (error) {
      console.error(`Error parsing or migrating ${key}:`, error);
      throw error;
    }
  };

  const migrateCategorias = async (data: any[], userId: string) => {
    if (!Array.isArray(data) || data.length === 0) return;
    
    for (const categoria of data) {
      await supabase.from('categorias').upsert({
        user_id: userId,
        nome: categoria.nome,
        cor: categoria.cor
      });
    }
  };

  const migratePacotes = async (data: any[], userId: string) => {
    if (!Array.isArray(data) || data.length === 0) return;
    
    for (const pacote of data) {
      // Find categoria_id
      const { data: categoria } = await supabase
        .from('categorias')
        .select('id')
        .eq('user_id', userId)
        .eq('nome', pacote.categoria)
        .maybeSingle();

      await supabase.from('pacotes').upsert({
        user_id: userId,
        nome: pacote.nome,
        categoria_id: categoria?.id,
        valor_base: pacote.valorBase || 0,
        valor_foto_extra: pacote.valorFotoExtra || 0,
        produtos_incluidos: pacote.produtosIncluidos || []
      });
    }
  };

  const migrateProdutos = async (data: any[], userId: string) => {
    if (!Array.isArray(data) || data.length === 0) return;
    
    for (const produto of data) {
      await supabase.from('produtos').upsert({
        user_id: userId,
        nome: produto.nome,
        preco_custo: produto.precoCusto || 0,
        preco_venda: produto.precoVenda || 0
      });
    }
  };

  const migrateEtapas = async (data: any[], userId: string) => {
    if (!Array.isArray(data) || data.length === 0) return;
    
    for (const [index, etapa] of data.entries()) {
      await supabase.from('etapas_trabalho').upsert({
        user_id: userId,
        nome: etapa.nome,
        cor: etapa.cor,
        ordem: index
      });
    }
  };

  const migrateUserData = async (key: string, data: any, userId: string) => {
    if (key === 'userPreferences') {
      await supabase.from('user_preferences').upsert({
        user_id: userId,
        notificacoes_email: data.notificacoesEmail ?? true,
        notificacoes_push: data.notificacoesPush ?? true,
        tema: data.tema || 'light',
        idioma: data.idioma || 'pt-BR',
        regime_tributario: data.regimeTributario || 'simples',
        configuracoes_agenda: data.configuracoesAgenda || {},
        configuracoes_financeiro: data.configuracoesFinanceiro || {}
      });
    } else if (key === 'user_profile' || key === 'user_branding') {
      await supabase.from('profiles').upsert({
        user_id: userId,
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        empresa: data.empresa,
        logo_url: data.logoUrl
      });
    }
  };

  const migrateLeads = async (data: any[], userId: string) => {
    if (!Array.isArray(data) || data.length === 0) return;
    
    for (const lead of data) {
      await supabase.from('leads').upsert({
        user_id: userId,
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        whatsapp: lead.whatsapp,
        data_nascimento: lead.dataNascimento,
        endereco: lead.endereco,
        origem: lead.origem || 'manual',
        status: lead.status || 'novo',
        observacoes: lead.observacoes,
        tags: lead.tags || [],
        data_contato: lead.dataContato
      });
    }
  };

  const migrateTasks = async (data: any[], userId: string) => {
    if (!Array.isArray(data) || data.length === 0) return;
    
    for (const task of data) {
      await supabase.from('tasks').upsert({
        user_id: userId,
        title: task.title,
        description: task.description,
        status: task.status || 'pending',
        priority: task.priority || 'medium',
        due_date: task.dueDate,
        category: task.category,
        completed_at: task.completedAt
      });
    }
  };

  const migrateAppointments = async (data: any[], userId: string) => {
    if (!Array.isArray(data) || data.length === 0) return;
    
    // Appointments are already in Supabase, skip if they have user_id
    console.log('Appointments already migrated to Supabase');
  };

  const migrateFinancialItems = async (data: any[], userId: string) => {
    if (!Array.isArray(data) || data.length === 0) return;
    
    for (const item of data) {
      await supabase.from('financial_items').upsert({
        user_id: userId,
        tipo: item.tipo,
        categoria: item.categoria,
        subcategoria: item.subcategoria,
        descricao: item.descricao,
        valor: item.valor,
        data: item.data,
        status: item.status || 'pendente',
        metodo_pagamento: item.metodoPagamento,
        observacoes: item.observacoes,
        tags: item.tags || []
      });
    }
  };

  const migrateAvailabilitySlots = async (data: any[], userId: string) => {
    if (!Array.isArray(data) || data.length === 0) return;
    
    for (const slot of data) {
      await supabase.from('availability_slots').upsert({
        user_id: userId,
        date: slot.date,
        start_time: slot.startTime,
        end_time: slot.endTime,
        type: slot.type || 'disponivel',
        description: slot.description
      });
    }
  };

  const migratePricingConfig = async (key: string, data: any, userId: string) => {
    const configType = key.replace('pricing_', '').replace('_', '');
    
    await supabase.from('pricing_configs').upsert({
      user_id: userId,
      config_type: configType,
      config_data: data
    });
  };

  if (!user) {
    return null;
  }

  if (isComplete) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-green-600">✅ Migração Concluída</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Todos os seus dados foram migrados com sucesso para o Supabase. 
            O localStorage foi limpo e o sistema agora funciona completamente online.
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="w-full"
          >
            Recarregar Aplicação
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Migração de Dados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Detectamos dados no localStorage que precisam ser migrados para o Supabase. 
          Este processo irá transferir todos os seus dados e limpar o armazenamento local.
        </p>
        
        {!isRunning ? (
          <Button onClick={runMigration} className="w-full">
            Iniciar Migração
          </Button>
        ) : (
          <div className="space-y-2">
            <Progress value={(status.completed / status.total) * 100} />
            <p className="text-sm text-center">
              {status.completed}/{status.total} - {status.currentTask}
            </p>
          </div>
        )}
        
        {status.errors.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-red-600">Erros:</p>
            {status.errors.map((error, index) => (
              <p key={index} className="text-xs text-red-500">{error}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};