import { Bindings } from '../index.js';

export const R2_PUBLIC_BUCKET = "lunari-previews";
export const R2_PRIVATE_BUCKET = "lunari-private";
export const R2_COMMERCIAL_BUCKET = "lunari-commercial-documents";
export const R2_MEDIA_BUCKET = "lunari-media";
export const R2_GALLERY_BUCKET = "lunari-gallery";

/**
 * Retorna o binding nativo do R2 com base no caminho do arquivo.
 */
export function getBucketBinding(env: Bindings, storagePath: string): { bucket: R2Bucket; bucketName: string } {
  if (
    storagePath.startsWith("gestao/client-documents/") ||
    storagePath.startsWith("gestao/task-attachments/") ||
    storagePath.startsWith("gestao/contratos-assinados/") ||
    storagePath.startsWith("gestao/support/tickets/") ||
    storagePath.startsWith("client-documents/") ||
    storagePath.startsWith("contratos-assinados/") ||
    storagePath.startsWith("media/task/")
  ) {
    return { bucket: env.LUNARI_PRIVATE, bucketName: R2_PRIVATE_BUCKET };
  }

  if (storagePath.startsWith("propostas/")) {
    return { bucket: env.LUNARI_COMMERCIAL_DOCUMENTS, bucketName: R2_COMMERCIAL_BUCKET };
  }

  if (storagePath.startsWith("gallery/") || storagePath.startsWith("galerias/")) {
    return { bucket: env.LUNARI_GALLERY, bucketName: R2_GALLERY_BUCKET };
  }

  return { bucket: env.LUNARI_PREVIEWS, bucketName: R2_PUBLIC_BUCKET };
}

export function getCdnUrl(env: Bindings, storagePath: string, bucketName: string): string {
  if (bucketName === R2_COMMERCIAL_BUCKET) {
    return `${env.R2_COMMERCIAL_CDN_BASE}/${storagePath}`;
  }
  return `${env.R2_CDN_BASE}/${storagePath}`;
}
