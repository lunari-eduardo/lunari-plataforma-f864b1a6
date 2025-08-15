import { UploadedFile } from '@/hooks/useFileUpload';

export interface TemplateFile extends UploadedFile {
  categoria: 'contrato' | 'proposta' | 'catalogo' | 'outros';
  isTemplate: true;
  visivel: boolean;
}

export const TEMPLATE_CATEGORIES = {
  contrato: { label: 'Contratos', color: '#FF2D55' },
  proposta: { label: 'Propostas', color: '#007AFF' },
  catalogo: { label: 'Catálogos', color: '#34C759' },
  outros: { label: 'Outros', color: '#8E8E93' }
} as const;