import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SEOHead } from '@/components/seo/SEOHead';
import { usePostById, useBlogMutations } from '@/hooks/useBlogPosts';
import { generateSlug } from '@/lib/slug';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BlockEditor } from '@/components/blog/BlockEditor';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Save, Eye, EyeOff, Trash2, Loader2, ExternalLink } from 'lucide-react';

/**
 * Página de edição de artigo
 * Rota: /admin/conteudos/editar/:id
 */
export default function AdminConteudoEditar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: post, isLoading } = usePostById(id || '');
  const { updatePost, deletePost, togglePublish } = useBlogMutations();
  
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Carregar dados do post
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setSlug(post.slug);
      setContent(post.content);
      setMetaTitle(post.meta_title || '');
      setMetaDescription(post.meta_description || '');
      setFeaturedImageUrl(post.featured_image_url || '');
    }
  }, [post]);

  const handleSlugChange = (value: string) => {
    setSlug(generateSlug(value));
  };

  const handleSave = async () => {
    if (!id || !title || !slug) return;

    updatePost.mutate({
      id,
      title,
      slug,
      content,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
      featured_image_url: featuredImageUrl || null,
    });
  };

  const handleTogglePublish = () => {
    if (!id || !post) return;
    togglePublish.mutate({ id, currentStatus: post.status });
  };

  const handleDelete = () => {
    if (!id) return;
    deletePost.mutate(id, {
      onSuccess: () => {
        navigate('/admin/conteudos');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Artigo não encontrado.</p>
        <Button variant="link" onClick={() => navigate('/admin/conteudos')}>
          Voltar para lista
        </Button>
      </div>
    );
  }

  const isPublished = post.status === 'published';

  return (
    <div className="space-y-6">
      <SEOHead title={`Editar: ${post.title} | Admin`} noindex />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/conteudos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Editar Artigo</h1>
              <Badge variant={isPublished ? 'default' : 'secondary'}>
                {isPublished ? 'Publicado' : 'Rascunho'}
              </Badge>
            </div>
            <p className="text-muted-foreground">{post.title}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPublished && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/conteudos/${post.slug}`, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Ver publicado
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTogglePublish}
            disabled={togglePublish.isPending}
            className="gap-2"
          >
            {isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {isPublished ? 'Despublicar' : 'Publicar'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="gap-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updatePost.isPending || !title || !slug}
            className="gap-2"
          >
            {updatePost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Conteúdo principal */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título do artigo"
              className="text-lg"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL) *</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/conteudos/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="url-do-artigo"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Conteúdo</Label>
            <BlockEditor
              value={content}
              onChange={setContent}
              placeholder="Comece a escrever seu artigo..."
            />
          </div>
        </div>
        
        {/* Sidebar - SEO e configurações */}
        <div className="space-y-6">
          <div className="p-4 border rounded-lg space-y-4">
            <h3 className="font-semibold text-foreground">SEO</h3>
            
            <div className="space-y-2">
              <Label htmlFor="metaTitle">Meta Title</Label>
              <Input
                id="metaTitle"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder={title || 'Título para buscadores'}
              />
              <p className="text-xs text-muted-foreground">
                {(metaTitle || title).length}/60 caracteres
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="metaDescription">Meta Description</Label>
              <Textarea
                id="metaDescription"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Descrição para buscadores..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {metaDescription.length}/160 caracteres
              </p>
            </div>
          </div>
          
          <div className="p-4 border rounded-lg space-y-4">
            <h3 className="font-semibold text-foreground">Imagem destacada</h3>
            
            <div className="space-y-2">
              <Label htmlFor="featuredImage">URL da imagem</Label>
              <Input
                id="featuredImage"
                value={featuredImageUrl}
                onChange={(e) => setFeaturedImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            
            {featuredImageUrl && (
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={featuredImageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir artigo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O artigo "{post.title}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
