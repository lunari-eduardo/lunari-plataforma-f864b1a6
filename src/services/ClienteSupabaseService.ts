/**
 * Service for client document management with Supabase Storage
 * Handles file uploads, downloads, and document metadata
 */

import { supabase } from '@/integrations/supabase/client';
import type { ClienteDocumento } from '@/types/cliente-supabase';

export class ClienteSupabaseService {
  
  // ============= DOCUMENT UPLOAD (Cloudflare R2) =============

  static async uploadDocument(
    clienteId: string,
    file: File,
    descricao?: string
  ): Promise<ClienteDocumento> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const ALLOWED_DOCUMENT_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
        throw new Error('Tipo de arquivo não permitido. Apenas PDF, imagens e documentos Office são aceitos.');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Arquivo muito grande. Tamanho máximo: 10MB');
      }
      const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx'];
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
        throw new Error('Extensão de arquivo inválida');
      }

      // Upload via edge function (R2 privado)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', 'client-document');
      formData.append('entityId', clienteId);

      const { data: upRes, error: upErr } = await supabase.functions.invoke('r2-upload', { body: formData });
      if (upErr) throw upErr;
      if (!upRes?.success) throw new Error(upRes?.error || 'Falha no upload');

      const r2Path = upRes.storagePath as string;

      // Salvar metadados (storage_path = r2Path para novos registros)
      const { data: docData, error: docError } = await supabase
        .from('clientes_documentos')
        .insert({
          cliente_id: clienteId,
          user_id: user.id,
          nome: file.name,
          tipo: file.type,
          tamanho: file.size,
          storage_path: r2Path,
          r2_storage_path: r2Path,
          descricao,
        })
        .select()
        .single();

      if (docError) throw docError;
      return docData as ClienteDocumento;
    } catch (error) {
      console.error('❌ Error uploading document:', error);
      throw error;
    }
  }

  // ============= DOCUMENT DOWNLOAD =============

  static async downloadDocument(documento: ClienteDocumento): Promise<Blob> {
    const url = await this.getDocumentUrl(documento);
    if (!url) throw new Error('URL não disponível');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao baixar documento');
    return await res.blob();
  }

  // ============= DOCUMENT URL =============

  static async getDocumentUrl(documento: ClienteDocumento): Promise<string> {
    const r2Path = documento.r2_storage_path || (documento.storage_path?.startsWith('client-documents/') ? documento.storage_path : null);
    if (r2Path) {
      const { data, error } = await supabase.functions.invoke('r2-signed-url', {
        body: { storagePath: r2Path, expiresIn: 300 },
      });
      if (error || !data?.url) throw new Error('Falha ao gerar URL');
      return data.url as string;
    }
    // Legacy Supabase Storage
    const { data } = supabase.storage.from('client-documents').getPublicUrl(documento.storage_path);
    return data.publicUrl;
  }

  // ============= DELETE DOCUMENT =============

  static async deleteDocument(documento: ClienteDocumento): Promise<void> {
    try {
      const r2Path = documento.r2_storage_path || (documento.storage_path?.startsWith('client-documents/') ? documento.storage_path : null);
      if (r2Path) {
        await supabase.functions.invoke('r2-delete', { body: { storagePath: r2Path } });
      } else if (documento.storage_path) {
        await supabase.storage.from('client-documents').remove([documento.storage_path]);
      }

      const { error: dbError } = await supabase
        .from('clientes_documentos')
        .delete()
        .eq('id', documento.id);
      if (dbError) throw dbError;
    } catch (error) {
      console.error('❌ Error deleting document:', error);
      throw error;
    }
  }

  // ============= MIGRATE BASE64 DOCUMENTS =============
  
  static async migrateBase64Documents(clienteId: string, base64Files: any[]): Promise<void> {
    try {
      for (const fileData of base64Files) {
        if (!fileData.content || !fileData.name) continue;

        // Convert base64 to blob
        const base64Data = fileData.content.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: fileData.type || 'application/octet-stream' });
        
        // Create File object
        const file = new File([blob], fileData.name, { type: fileData.type });
        
        // Upload to Supabase
        await this.uploadDocument(clienteId, file, 'Migrado do sistema anterior');
      }
    } catch (error) {
      console.error('❌ Error migrating base64 documents:', error);
      throw error;
    }
  }

  // ============= DOCUMENT STATS =============
  
  static async getClientDocumentStats(clienteId: string): Promise<{
    totalDocuments: number;
    totalSize: number;
    typeBreakdown: Record<string, number>;
  }> {
    try {
      const { data, error } = await supabase
        .from('clientes_documentos')
        .select('tipo, tamanho')
        .eq('cliente_id', clienteId);

      if (error) throw error;

      const totalDocuments = data.length;
      const totalSize = data.reduce((sum, doc) => sum + doc.tamanho, 0);
      const typeBreakdown = data.reduce((acc, doc) => {
        acc[doc.tipo] = (acc[doc.tipo] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return { totalDocuments, totalSize, typeBreakdown };
    } catch (error) {
      console.error('❌ Error getting document stats:', error);
      throw error;
    }
  }
}