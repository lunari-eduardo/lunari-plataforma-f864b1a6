import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BlogPost {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  featured_image_url: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BlogPostInsert = Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>;
export type BlogPostUpdate = Partial<Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>>;

const QUERY_KEY = 'blog_posts';

// Fetch apenas posts publicados (público)
export function usePublishedPosts() {
  return useQuery({
    queryKey: [QUERY_KEY, 'published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (error) throw error;
      return data as BlogPost[];
    },
  });
}

// Fetch post por slug (público)
export function usePostBySlug(slug: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (error) throw error;
      return data as BlogPost;
    },
    enabled: !!slug,
  });
}

// Fetch todos os posts (admin)
export function useAllPosts() {
  return useQuery({
    queryKey: [QUERY_KEY, 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BlogPost[];
    },
  });
}

// Fetch post por ID (admin)
export function usePostById(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'id', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as BlogPost;
    },
    enabled: !!id,
  });
}

// Mutations para admin
export function useBlogMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createPost = useMutation({
    mutationFn: async (post: BlogPostInsert) => {
      const { data, error } = await supabase
        .from('blog_posts')
        .insert(post)
        .select()
        .single();

      if (error) throw error;
      return data as BlogPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Artigo criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao criar artigo', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, ...updates }: BlogPostUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('blog_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BlogPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Artigo atualizado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao atualizar artigo', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Artigo excluído com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao excluir artigo', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'published' ? 'draft' : 'published';
      const publishedAt = newStatus === 'published' ? new Date().toISOString() : null;

      const { data, error } = await supabase
        .from('blog_posts')
        .update({ status: newStatus, published_at: publishedAt })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BlogPost;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ 
        title: data.status === 'published' ? 'Artigo publicado!' : 'Artigo despublicado' 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao alterar status', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return { createPost, updatePost, deletePost, togglePublish };
}
