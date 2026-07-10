/**
 * Entry-point público do módulo Gallery.
 * Importe SOMENTE deste arquivo no resto do app.
 */

// Registra eventos
import "./domain/events";

// Capabilities (registram-se no registry ao importar)
import "./application/queries/checkAccess";
import "./application/queries/listInSelection";
import "./application/queries/listExpiring";
import "./application/commands/reopenSelection";

export { checkAccess } from "./application/queries/checkAccess";
export { listInSelection } from "./application/queries/listInSelection";
export { listExpiring } from "./application/queries/listExpiring";
export { reopenSelection } from "./application/commands/reopenSelection";

export type {
  CheckGalleryAccessInput,
  CheckGalleryAccessOutput,
} from "./domain/types";

import { checkAccess as _q1 } from "./application/queries/checkAccess";
import { listInSelection as _q2 } from "./application/queries/listInSelection";
import { listExpiring as _q3 } from "./application/queries/listExpiring";
import { reopenSelection as _c1 } from "./application/commands/reopenSelection";
export const galleryCapabilities = [_q1, _q2, _q3, _c1] as const;
