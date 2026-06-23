/**
 * Entry-point público do módulo Gallery.
 * Importe SOMENTE deste arquivo no resto do app.
 */

// Capabilities (queries)
export { checkAccess } from "./application/queries/checkAccess";

// Tipos públicos
export type {
  CheckGalleryAccessInput,
  CheckGalleryAccessOutput,
} from "./domain/types";

import { checkAccess as _q1 } from "./application/queries/checkAccess";
export const galleryCapabilities = [_q1] as const;
