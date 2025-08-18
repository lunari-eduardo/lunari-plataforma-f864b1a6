import { useCallback, useState, useEffect } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type { Task, TaskPriority } from '@/types/tasks';

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'photography' | 'client' | 'production' | 'marketing' | 'general';
  icon: string;
  taskType: 'simple' | 'content' | 'checklist' | 'document';
  template: {
    title: string;
    description?: string;
    priority: TaskPriority;
    tags?: string[];
    estimatedHours?: number;
    callToAction?: string;
    socialPlatforms?: string[];
    checklistItems?: Array<{
      text: string;
      completed: boolean;
    }>;
    attachments?: Array<{
      name: string;
      type: 'document' | 'text';
      content?: string;
    }>;
    captions?: Array<{
      title: string;
      content: string;
      platform?: 'instagram' | 'facebook' | 'general';
      hashtags?: string[];
    }>;
  };
  createdAt: string;
}

const DEFAULT_TEMPLATES: TaskTemplate[] = [
  {
    id: 'template_client_contact',
    name: 'Contato com Cliente',
    description: 'Template para contatos iniciais com clientes',
    category: 'client',
    icon: '📞',
    taskType: 'simple',
    template: {
      title: 'Entrar em contato com {cliente}',
      description: 'Realizar contato inicial para discussão do projeto',
      priority: 'high',
      tags: ['cliente', 'contato'],
      estimatedHours: 0.5,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'template_photo_edit_checklist',
    name: 'Checklist Edição de Fotos',
    description: 'Lista de tarefas para edição fotográfica',
    category: 'production',
    icon: '📸',
    taskType: 'checklist',
    template: {
      title: 'Editar fotos - {sessao}',
      description: 'Checklist completo para edição e tratamento das fotos',
      priority: 'medium',
      tags: ['edição', 'produção'],
      estimatedHours: 4,
      checklistItems: [
        { text: 'Importar fotos RAW', completed: false },
        { text: 'Pré-seleção das melhores fotos', completed: false },
        { text: 'Ajuste de exposição e contraste', completed: false },
        { text: 'Correção de cores e balanço de branco', completed: false },
        { text: 'Retoque básico de pele', completed: false },
        { text: 'Aplicação de filtros/preset', completed: false },
        { text: 'Exportação para galeria', completed: false }
      ]
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'template_newborn_content',
    name: 'Legenda Ensaio Newborn',
    description: 'Template para posts de ensaio newborn',
    category: 'marketing',
    icon: '👶',
    taskType: 'content',
    template: {
      title: 'Post ensaio newborn - {cliente}',
      description: 'Cada pequeno detalhe conta uma grande história ✨\n\nO ensaio newborn da {cliente} foi pura magia! Aqueles primeiros dias são únicos e merecem ser eternizados com todo o carinho.\n\n{detalhes}',
      priority: 'medium',
      tags: ['newborn', 'ensaio', 'social'],
      estimatedHours: 1,
      callToAction: 'Agende seu ensaio newborn no link da bio 👆 Vagas limitadas!',
      socialPlatforms: ['instagram', 'facebook'],
      captions: [
        {
          title: 'Instagram - Post Principal',
          content: 'Cada pequeno detalhe conta uma grande história ✨',
          platform: 'instagram',
          hashtags: ['newborn', 'ensaionewborn', 'recem-nascido', 'fotografia', 'momentosunicos']
        }
      ]
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'template_delivery_documents',
    name: 'Entrega de Fotos - Documentos',
    description: 'Template para organizar entrega com documentos',
    category: 'client',
    icon: '📦',
    taskType: 'document',
    template: {
      title: 'Entregar fotos - {cliente}',
      description: 'Finalizar e entregar as fotos editadas ao cliente com toda documentação',
      priority: 'high',
      tags: ['entrega', 'cliente', 'documentos'],
      estimatedHours: 1,
      attachments: [
        {
          name: 'Checklist de Entrega',
          type: 'text',
          content: '• Fotos em alta resolução\n• Fotos para web\n• Galeria online criada\n• Cliente notificado\n• Feedback coletado'
        }
      ]
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'template_atendimento_checklist',
    name: 'Checklist Atendimento Cliente',
    description: 'Processo completo de atendimento',
    category: 'client',
    icon: '✅',
    taskType: 'checklist',
    template: {
      title: 'Atendimento completo - {cliente}',
      description: 'Checklist para garantir excelência no atendimento',
      priority: 'high',
      tags: ['cliente', 'atendimento', 'processo'],
      estimatedHours: 2,
      checklistItems: [
        { text: 'Primeiro contato via WhatsApp', completed: false },
        { text: 'Envio de portfólio personalizado', completed: false },
        { text: 'Apresentação de pacotes e valores', completed: false },
        { text: 'Agendamento da sessão', completed: false },
        { text: 'Confirmação 24h antes', completed: false },
        { text: 'Realização da sessão', completed: false },
        { text: 'Pré-visualização das fotos', completed: false },
        { text: 'Entrega final', completed: false }
      ]
    },
    createdAt: new Date().toISOString(),
  }
];

export function useTaskTemplates() {
  const [templates, setTemplates] = useState<TaskTemplate[]>(() => {
    const stored = storage.load<TaskTemplate[]>(STORAGE_KEYS.TASK_TEMPLATES, []);
    if (stored.length === 0) {
      return DEFAULT_TEMPLATES;
    }
    return stored;
  });

  useEffect(() => {
    storage.save(STORAGE_KEYS.TASK_TEMPLATES, templates);
  }, [templates]);

  const addTemplate = useCallback((templateData: Omit<TaskTemplate, 'id' | 'createdAt'>) => {
    const template: TaskTemplate = {
      ...templateData,
      id: `template_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setTemplates(prev => [template, ...prev]);
    return template;
  }, []);

  const updateTemplate = useCallback((id: string, updates: Partial<TaskTemplate>) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const getTemplatesByCategory = useCallback((category: TaskTemplate['category']) => {
    return templates.filter(t => t.category === category);
  }, [templates]);

  const applyTemplate = useCallback((templateId: string, variables: Record<string, string> = {}): Partial<Task> => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return {};

    const replaceVariables = (text: string) => {
      return Object.entries(variables).reduce((acc, [key, value]) => {
        return acc.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }, text);
    };

    const taskData: Partial<Task> = {
      title: replaceVariables(template.template.title),
      description: template.template.description ? replaceVariables(template.template.description) : undefined,
      priority: template.template.priority,
      tags: template.template.tags,
      estimatedHours: template.template.estimatedHours,
      type: template.taskType,
      status: 'todo',
      source: 'manual',
      callToAction: template.template.callToAction ? replaceVariables(template.template.callToAction) : undefined,
      socialPlatforms: template.template.socialPlatforms,
    };

    // Apply attachments if any
    if (template.template.attachments) {
      taskData.attachments = template.template.attachments.map(att => ({
        id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: att.name,
        type: att.type,
        content: att.content ? replaceVariables(att.content) : undefined,
        uploadedAt: new Date().toISOString(),
      }));
    }

    // Apply captions if any
    if (template.template.captions) {
      taskData.captions = template.template.captions.map(cap => ({
        id: `cap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: cap.title,
        content: replaceVariables(cap.content),
        platform: cap.platform,
        hashtags: cap.hashtags,
        createdAt: new Date().toISOString(),
      }));
    }

    // Apply checklist items if any
    if (template.template.checklistItems) {
      taskData.checklistItems = template.template.checklistItems.map(item => ({
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: replaceVariables(item.text),
        completed: item.completed,
        createdAt: new Date().toISOString(),
      }));
    }

    return taskData;
  }, [templates]);

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplatesByCategory,
    applyTemplate
  };
}