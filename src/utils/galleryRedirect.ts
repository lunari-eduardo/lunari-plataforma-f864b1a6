import { EXTERNAL_URLS } from '@/config/externalUrls';

export interface GalleryRedirectParams {
  sessionId: string;      // session_id formato texto (workflow-*)
  sessionUuid?: string;   // UUID da sessão (id da clientes_sessoes)
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
  
  // session_id texto como identificador principal
  searchParams.set('session_id', params.sessionId);
  
  // UUID como backup para o Gallery buscar por qualquer um
  if (params.sessionUuid) {
    searchParams.set('session_uuid', params.sessionUuid);
  }
  
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
    // Nome esperado pelo Gallery (useGestaoParams):
    searchParams.set('fotos_incluidas_no_pacote', String(params.fotosIncluidas));
    // Alias legado para compatibilidade temporária:
    searchParams.set('fotos_incluidas', String(params.fotosIncluidas));
  }

  if (params.modeloCobranca) {
    // Nome esperado pelo Gallery:
    searchParams.set('modelo_de_cobranca', params.modeloCobranca);
    // Alias legado:
    searchParams.set('modelo_cobranca', params.modeloCobranca);
  }

  if (params.precoExtra !== undefined && params.precoExtra > 0) {
    // Sanitiza espelhando sanitizeExtraPrice da Gallery (clamp 0–999.99)
    const sanitized = Math.min(Math.max(Number(params.precoExtra) || 0, 0), 999.99);
    if (sanitized > 0) {
      // Nome esperado pelo Gallery:
      searchParams.set('preco_da_foto_extra', String(sanitized));
      // Alias legado:
      searchParams.set('preco_extra', String(sanitized));
    }
  }

  if (params.tipoAssinatura) {
    searchParams.set('tipo_assinatura', params.tipoAssinatura);
  }
  
  return `${EXTERNAL_URLS.GALLERY.BASE}${EXTERNAL_URLS.GALLERY.NEW}?${searchParams.toString()}`;
}

/**
 * Constrói a URL para criação de galeria de entrega (deliver/transfer)
 * Parâmetros simplificados comparados à galeria de seleção
 */
export interface GalleryDeliverParams {
  sessionId: string;
  sessionUuid?: string;
  clienteId?: string;
  clienteNome: string;
}

export function buildGalleryDeliverUrl(params: GalleryDeliverParams): string {
  const searchParams = new URLSearchParams();
  
  searchParams.set('session_id', params.sessionId);
  
  if (params.sessionUuid) {
    searchParams.set('session_uuid', params.sessionUuid);
  }
  
  if (params.clienteId) {
    searchParams.set('cliente_id', params.clienteId);
  }
  
  searchParams.set('cliente_nome', params.clienteNome);
  
  return `${EXTERNAL_URLS.GALLERY.BASE}${EXTERNAL_URLS.GALLERY.DELIVER_NEW}?${searchParams.toString()}`;
}
