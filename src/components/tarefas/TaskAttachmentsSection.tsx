import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, Image, Upload, Plus, Trash2, Download, Eye, FileImage, Type } from 'lucide-react';
import type { Task } from '@/types/tasks';
import { useTaskAttachments } from '@/hooks/useTaskAttachments';
import { formatDateForDisplay } from '@/utils/dateUtils';

interface TaskAttachmentsSectionProps {
  task: Task;
  onUpdateTask: (updates: Partial<Task>) => void;
}

export default function TaskAttachmentsSection({ task, onUpdateTask }: TaskAttachmentsSectionProps) {
  const { uploadAttachment, removeAttachment, addTextAttachment } = useTaskAttachments(task, onUpdateTask);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [textName, setTextName] = useState('');
  const [textContent, setTextContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadAttachment(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddText = () => {
    if (textName.trim() && textContent.trim()) {
      addTextAttachment(textName, textContent);
      setTextName('');
      setTextContent('');
      setTextModalOpen(false);
    }
  };

  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'text': return <Type className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getFileSize = (size?: number) => {
    if (!size) return '';
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  };

  const downloadAttachment = (attachment: any) => {
    if (attachment.type === 'text') {
      const blob = new Blob([attachment.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      a.click();
      URL.revokeObjectURL(url);
    } else if (attachment.url) {
      const a = document.createElement('a');
      a.href = attachment.url;
      a.download = attachment.name;
      a.click();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lunar-text">Anexos</h3>
        <div className="flex gap-2">
          <Dialog open={textModalOpen} onOpenChange={setTextModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                <Type className="w-3 h-3 mr-1" />
                Texto
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-lunar-surface border-lunar-border">
              <DialogHeader>
                <DialogTitle className="text-lunar-text">Adicionar Texto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-lunar-text">Nome do arquivo</label>
                  <Input
                    value={textName}
                    onChange={(e) => setTextName(e.target.value)}
                    placeholder="Ex: Roteiro do ensaio"
                    className="bg-lunar-background border-lunar-border"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-lunar-text">Conteúdo</label>
                  <Textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Digite o conteúdo do texto..."
                    className="min-h-[100px] bg-lunar-background border-lunar-border"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddText} className="flex-1">
                    Salvar Texto
                  </Button>
                  <Button variant="outline" onClick={() => setTextModalOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3 h-3 mr-1" />
            Arquivo
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
      />

      {task.attachments && task.attachments.length > 0 ? (
        <div className="space-y-2">
          {task.attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-3 p-3 rounded-lg border border-lunar-border/60 bg-lunar-background/50">
              <div className="text-lunar-textSecondary">
                {getAttachmentIcon(attachment.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-lunar-text truncate">
                    {attachment.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {attachment.type}
                  </Badge>
                </div>
                <div className="text-xs text-lunar-textSecondary">
                  {formatDateForDisplay(attachment.uploadedAt)}
                  {attachment.size && ` • ${getFileSize(attachment.size)}`}
                </div>
              </div>

              <div className="flex gap-1">
                {attachment.type === 'text' && attachment.content && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Eye className="w-3 h-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-lunar-surface border-lunar-border max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-lunar-text">{attachment.name}</DialogTitle>
                      </DialogHeader>
                      <div className="max-h-96 overflow-y-auto">
                        <pre className="text-sm text-lunar-textSecondary whitespace-pre-wrap">
                          {attachment.content}
                        </pre>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  onClick={() => downloadAttachment(attachment)}
                >
                  <Download className="w-3 h-3" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                  onClick={() => removeAttachment(attachment.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-lunar-textSecondary">Nenhum anexo</p>
      )}
    </div>
  );
}