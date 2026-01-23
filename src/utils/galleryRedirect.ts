import { EXTERNAL_URLS } from '@/config/externalUrls';

export interface GalleryRedirectParams {
  sessionId: string;
  clienteId?: string;
  clienteNome: string;
  clienteEmail?: string;
  clienteTelefone?: string;
  pacoteNome?: string;
  pacoteCategoria?: string;
  fotosIncluidas?: number;
  modeloCobranca?: string;
  precoExtra?: number;
  tipoAssinatura?: string;
}

/**
 * Constrói a URL de redirecionamento para criação de galeria
 * com todos os dados da sessão como query params
 */
export function buildGalleryNewUrl(params: GalleryRedirectParams): string {
  const searchParams = new URLSearchParams();
  
  searchParams.set('session_id', params.sessionId);
  
  if (params.clienteId) {
    searchParams.set('cliente_id', params.clienteId);
  }
  
  searchParams.set('cliente_nome', params.clienteNome);
  
  if (params.clienteEmail) {
    searchParams.set('cliente_email', params.clienteEmail);
  }
  
  if (params.clienteTelefone) {
    searchParams.set('cliente_telefone', params.clienteTelefone);
  }
  
  if (params.pacoteNome) {
    searchParams.set('pacote_nome', params.pacoteNome);
  }
  
  if (params.pacoteCategoria) {
    searchParams.set('pacote_categoria', params.pacoteCategoria);
  }
  
  if (params.fotosIncluidas !== undefined && params.fotosIncluidas > 0) {
    searchParams.set('fotos_incluidas', String(params.fotosIncluidas));
  }
  
  if (params.modeloCobranca) {
    searchParams.set('modelo_cobranca', params.modeloCobranca);
  }
  
  if (params.precoExtra !== undefined && params.precoExtra > 0) {
    searchParams.set('preco_extra', String(params.precoExtra));
  }
  
  if (params.tipoAssinatura) {
    searchParams.set('tipo_assinatura', params.tipoAssinatura);
  }
  
  return `${EXTERNAL_URLS.GALLERY.BASE}${EXTERNAL_URLS.GALLERY.NEW}?${searchParams.toString()}`;
}
