import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFileUpload, UploadedFile } from '@/hooks/useFileUpload';

interface FileUploadZoneProps {
  clienteId?: string;
  orcamentoId?: string;
  description?: string;
  showExisting?: boolean;
  onFileUploaded?: (file: UploadedFile) => void;
}

export function FileUploadZone({
  clienteId,
  orcamentoId,
  description,
  showExisting = true,
  onFileUploaded
}: FileUploadZoneProps) {
  const { uploadFile, deleteFile, getFilesByClient, getFilesByOrcamento, uploading } = useFileUpload();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const uploadedFile = await uploadFile(file, {
        clienteId,
        orcamentoId,
        description
      });
      
      if (uploadedFile && onFileUploaded) {
        onFileUploaded(uploadedFile);
      }
    }
  }, [uploadFile, clienteId, orcamentoId, description, onFileUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const existingFiles = showExisting 
    ? (clienteId ? getFilesByClient(clienteId) : orcamentoId ? getFilesByOrcamento(orcamentoId) : [])
    : [];

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (tipo: string) => {
    if (tipo.includes('pdf')) return '📄';
    if (tipo.includes('image')) return '🖼️';
    if (tipo.includes('word') || tipo.includes('document')) return '📝';
    return '📎';
  };

  const handleDownload = (file: UploadedFile) => {
    // Criar link de download
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.nome;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Zona de Upload */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            
            {isDragActive ? (
              <p className="text-primary font-medium">Solte os arquivos aqui...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">
                  Arraste arquivos aqui ou clique para selecionar
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Suportamos PDF, JPG, PNG e DOC (máx. 10MB)
                </p>
                <Button variant="outline" disabled={uploading}>
                  {uploading ? 'Enviando...' : 'Selecionar Arquivos'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Arquivos Existentes */}
      {showExisting && existingFiles.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-medium mb-4">Arquivos Enviados</h3>
            <div className="space-y-3">
              {existingFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getFileIcon(file.tipo)}</span>
                    <div>
                      <p className="font-medium">{file.nome}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatFileSize(file.tamanho)}</span>
                        <span>•</span>
                        <span>{new Date(file.uploadDate).toLocaleDateString('pt-BR')}</span>
                        {file.description && (
                          <>
                            <span>•</span>
                            <Badge variant="outline">{file.description}</Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFile(file.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}