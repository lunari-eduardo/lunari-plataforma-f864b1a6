import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/seo/SEOHead';
import { useBlogMutations } from '@/hooks/useBlogPosts';
import { useAuth } from '@/contexts/AuthContext';
import { generateSlug } from '@/lib/slug';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BlockEditor } from '@/components/blog/BlockEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Eye, Loader2 } from 'lucide-react';

const SYSTEM_ROUTES = [
  { value: '/app', label: 'Dashboard' },
  { value: '/app/agenda', label: 'Agenda' },
  { value: '/app/clientes', label: 'Clientes' },
  { value: '/app/leads', label: 'Leads' },
  { value: '/app/workflow', label: 'Workflow' },
  { value: '/app/financas', label: 'Finanças' },
  { value: '/app/precificacao', label: 'Precificação' },
  { value: '/app/analise-vendas', label: 'Análise de Vendas' },
  { value: '/app/tarefas', label: 'Tarefas' },
  { value: '/app/configuracoes', label: 'Configurações' },
  { value: '/app/integracoes', label: 'Integrações' },
  { value: '/app/minha-conta', label: 'Minha Conta' },
];

export default function AdminConteudoNovo() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createPost } = useBlogMutations();
  
  const [contentType, setContentType] = useState<'blog' | 'help'>('blog');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [routeReference, setRouteReference] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isSlugManual, setIsSlugManual] = useState(false);

  useEffect(() => {
    if (!isSlugManual && title) {
      setSlug(generateSlug(title));
    }
  }, [title, isSlugManual]);

  const handleSlugChange = (value: string) => {
    setIsSlugManual(true);
    setSlug(generateSlug(value));
  };

  const handleSave = async (publish: boolean) => {
    if (!user || !title || !slug) return;

    const postData: any = {
      user_id: user.id,
      title,
      slug,
      content,
      meta_title: contentType === 'blog' ? (metaTitle || null) : null,
      meta_description: contentType === 'blog' ? (metaDescription || null) : null,
      featured_image_url: featuredImageUrl || null,
      status: publish ? 'published' as const : 'draft' as const,
      published_at: publish ? new Date().toISOString() : null,
      type: contentType,
      route_reference: contentType === 'help' ? (routeReference || null) : null,
      display_order: contentType === 'help' ? displayOrder : 0,
    };

    createPost.mutate(postData, {
      onSuccess: () => {
        navigate('/app/admin/conteudos');
      },
    });
  };

  return (
    <div className="space-y-6">
      <SEOHead title="Novo Conteúdo | Admin" noindex />
      
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/admin/conteudos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {contentType === 'help' ? 'Novo Artigo de Ajuda' : 'Novo Artigo'}
            </h1>
            <p className="text-muted-foreground">
              {contentType === 'help' ? 'Tutorial ou guia de uso do sistema' : 'Crie um novo conteúdo para o blog'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={createPost.isPending || !title || !slug}
            className="gap-2"
          >
            {createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar rascunho
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={createPost.isPending || !title || !slug}
            className="gap-2"
          >
            {createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Publicar
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
              <span className="text-sm text-muted-foreground">
                {contentType === 'help' ? '/app/ajuda/' : '/conteudos/'}
              </span>
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
              placeholder="Comece a escrever..."
            />
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tipo de conteúdo */}
          <div className="p-4 border rounded-lg space-y-4">
            <h3 className="font-semibold text-foreground">Tipo de Conteúdo</h3>
            <Select value={contentType} onValueChange={(v) => setContentType(v as 'blog' | 'help')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blog">📝 Blog</SelectItem>
                <SelectItem value="help">❓ Ajuda / Tutorial</SelectItem>
              </SelectContent>
            </Select>

            {contentType === 'help' && (
              <>
                <div className="space-y-2">
                  <Label>Página de referência</Label>
                  <Select value={routeReference} onValueChange={setRouteReference}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a página..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SYSTEM_ROUTES.map((route) => (
                        <SelectItem key={route.value} value={route.value}>
                          {route.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    O botão de ajuda nessa página levará a este artigo
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Ordem de exibição</Label>
                  <Input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    min={0}
                  />
                </div>
              </>
            )}
          </div>

          {/* SEO - apenas para blog */}
          {contentType === 'blog' && (
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
          )}
          
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
    </div>
  );
}
