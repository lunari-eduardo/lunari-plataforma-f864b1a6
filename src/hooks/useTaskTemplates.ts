import { useCallback, useState, useEffect } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type { Task, TaskPriority } from '@/types/tasks';

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'photography' | 'client' | 'production' | 'marketing' | 'general';
  icon: string;
  template: {
    title: string;
    description?: string;
    priority: TaskPriority;
    tags?: string[];
    estimatedHours?: number;
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
    id: 'template_photo_edit',
    name: 'Edição de Fotos',
    description: 'Template para tarefas de edição fotográfica',
    category: 'production',
    icon: '📸',
    template: {
      title: 'Editar fotos - {sessao}',
      description: 'Realizar edição e tratamento das fotos da sessão',
      priority: 'medium',
      tags: ['edição', 'produção'],
      estimatedHours: 4,
      attachments: [
        {
          name: 'Checklist de Edição',
          type: 'text',
          content: '• Ajuste de exposição\n• Correção de cores\n• Retoque básico\n• Redimensionamento\n• Exportação final'
        }
      ]
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'template_social_media',
    name: 'Post Redes Sociais',
    description: 'Template para criação de posts',
    category: 'marketing',
    icon: '📱',
    template: {
      title: 'Criar post - {tema}',
      description: 'Desenvolver conteúdo para redes sociais',
      priority: 'medium',
      tags: ['marketing', 'social'],
      estimatedHours: 1,
      captions: [
        {
          title: 'Instagram - Post Principal',
          content: 'Conte sua história através das nossas lentes ✨\n\n{descrição}\n\nAgende sua sessão no link da bio 📸',
          platform: 'instagram',
          hashtags: ['fotografia', 'ensaio', 'memories', 'photooftheday']
        }
      ]
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'template_delivery',
    name: 'Entrega de Fotos',
    description: 'Template para processo de entrega',
    category: 'client',
    icon: '📦',
    template: {
      title: 'Entregar fotos - {cliente}',
      description: 'Finalizar e entregar as fotos editadas ao cliente',
      priority: 'high',
      tags: ['entrega', 'cliente'],
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
      status: 'todo',
      source: 'manual',
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