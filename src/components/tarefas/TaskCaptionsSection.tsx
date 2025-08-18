import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit3, MessageSquare, Hash, Copy } from 'lucide-react';
import type { Task } from '@/types/tasks';
import { useTaskCaptions } from '@/hooks/useTaskCaptions';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { toast } from 'sonner';

interface TaskCaptionsSectionProps {
  task: Task;
  onUpdateTask: (updates: Partial<Task>) => void;
}

export default function TaskCaptionsSection({ task, onUpdateTask }: TaskCaptionsSectionProps) {
  const { addCaption, updateCaption, removeCaption } = useTaskCaptions(task, onUpdateTask);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [platform, setPlatform] = useState<string>('general');

  const handleSaveCaption = () => {
    if (!title.trim() || !content.trim()) return;

    const hashtagArray = hashtags
      .split(/[,\s]+/)
      .map(tag => tag.replace('#', '').trim())
      .filter(tag => tag.length > 0);

    if (editingCaption) {
      updateCaption(editingCaption, {
        title,
        content,
        hashtags: hashtagArray,
        platform: platform as any
      });
      setEditingCaption(null);
    } else {
      addCaption({
        title,
        content,
        hashtags: hashtagArray,
        platform: platform as any
      });
    }

    // Reset form
    setTitle('');
    setContent('');
    setHashtags('');
    setPlatform('general');
    setModalOpen(false);
  };

  const handleEditCaption = (caption: any) => {
    setTitle(caption.title);
    setContent(caption.content);
    setHashtags(caption.hashtags?.map((tag: string) => `#${tag}`).join(' ') || '');
    setPlatform(caption.platform || 'general');
    setEditingCaption(caption.id);
    setModalOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform) {
      case 'instagram': return '📷';
      case 'facebook': return '📘';
      default: return '💬';
    }
  };

  const getPlatformLabel = (platform?: string) => {
    switch (platform) {
      case 'instagram': return 'Instagram';
      case 'facebook': return 'Facebook';
      default: return 'Geral';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lunar-text">Biblioteca de Legendas</h3>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Nova Legenda
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-lunar-surface border-lunar-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lunar-text">
                {editingCaption ? 'Editar Legenda' : 'Nova Legenda'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-lunar-text">Título</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Post do ensaio na praia"
                  className="bg-lunar-background border-lunar-border"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-lunar-text">Plataforma</label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="bg-lunar-background border-lunar-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Geral</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-lunar-text">Legenda</label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Digite a legenda aqui..."
                  className="min-h-[120px] bg-lunar-background border-lunar-border"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-lunar-text">Hashtags</label>
                <Input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="#fotografia #casamento #love"
                  className="bg-lunar-background border-lunar-border"
                />
                <p className="text-xs text-lunar-textSecondary mt-1">
                  Separe as hashtags por espaço ou vírgula
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveCaption} className="flex-1">
                  {editingCaption ? 'Atualizar' : 'Salvar'} Legenda
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setModalOpen(false);
                    setEditingCaption(null);
                    setTitle('');
                    setContent('');
                    setHashtags('');
                    setPlatform('general');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {task.captions && task.captions.length > 0 ? (
        <div className="space-y-3">
          {task.captions.map((caption) => (
            <div key={caption.id} className="p-4 rounded-lg border border-lunar-border/60 bg-lunar-background/50">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{getPlatformIcon(caption.platform)}</span>
                  <h4 className="font-medium text-lunar-text">{caption.title}</h4>
                  <Badge variant="outline" className="text-xs">
                    {getPlatformLabel(caption.platform)}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => copyToClipboard(caption.content + (caption.hashtags?.length ? '\n\n' + caption.hashtags.map(tag => `#${tag}`).join(' ') : ''))}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => handleEditCaption(caption)}
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    onClick={() => removeCaption(caption.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <p className="text-sm text-lunar-textSecondary mb-3 leading-relaxed">
                {caption.content}
              </p>

              {caption.hashtags && caption.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {caption.hashtags.map((tag, index) => (
                    <span key={index} className="text-xs text-blue-400">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-xs text-lunar-textSecondary">
                Criado em: {formatDateForDisplay(caption.createdAt)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-lunar-textSecondary">Nenhuma legenda salva</p>
      )}
    </div>
  );
}