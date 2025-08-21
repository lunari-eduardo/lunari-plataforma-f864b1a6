import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { FileText, Image, Video, File } from 'lucide-react';
import RichTextEditor from '@/components/ui/rich-text-editor';

interface TaskDocumentFormProps {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  attachments: any[];
  setAttachments: (value: any[]) => void;
}

export default function TaskDocumentForm({ 
  title, 
  setTitle, 
  description, 
  setDescription,
  attachments,
  setAttachments
}: TaskDocumentFormProps) {

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (type.includes('pdf') || type.includes('doc')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const handleFilesSelected = (files: File[]) => {
    const newAttachments = files.map(file => ({
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'document',
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
      // In a real implementation, you'd upload the file and get a URL
      url: URL.createObjectURL(file)
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(att => att.id !== id));
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="title">Título do Documento *</Label>
        <Input 
          id="title" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          required 
          placeholder="Ex.: Contrato ensaio Maria" 
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição dos Documentos</Label>
        <RichTextEditor 
          value={description} 
          onChange={setDescription} 
          placeholder="Descreva os documentos ou instruções especiais..."
          minHeight="100px"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Arquivos e Documentos</Label>
        <div className="border-2 border-dashed border-lunar-border rounded-lg p-6 text-center">
          <input
            type="file"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              handleFilesSelected(files);
            }}
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-lunar-accent/10 flex items-center justify-center">
                📎
              </div>
              <div>
                <p className="text-sm font-medium">Clique para fazer upload</p>
                <p className="text-xs text-lunar-textSecondary">PDF, DOC, imagens até 10MB</p>
              </div>
            </div>
          </label>
        </div>
        
        {attachments.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {attachments.map(attachment => (
              <Card key={attachment.id} className="p-3">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3">
                    {getFileIcon(attachment.mimeType || '')}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{attachment.name}</div>
                      <div className="text-xs text-lunar-textSecondary">
                        {attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : 'Arquivo'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remover
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}