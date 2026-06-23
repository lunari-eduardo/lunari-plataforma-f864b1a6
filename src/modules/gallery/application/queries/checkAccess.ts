import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckGalleryAccessInputSchema,
  CheckGalleryAccessOutputSchema,
} from "../../domain/types";

/**
 * Capability `gallery.checkAccess`
 *
 * Fonte única de autorização para o módulo Gallery. Encapsula a função
 * `public.user_has_gallery_access` (SECURITY DEFINER) criada na Onda A.
 *
 * Regra:
 *  - admin → sempre tem acesso;
 *  - assinatura Asaas ativa com `includes_select` → tem acesso;
 *  - email listado em `allowed_emails` para Gallery → tem acesso.
 *
 * Pode ser chamada por Web, Mobile, Assistente e integrações sem reimplementar
 * a regra no cliente.
 */
export const checkAccess = defineQuery({
  id: "gallery.checkAccess",
  title: "Verificar acesso à Gallery",
  description:
    "Retorna se o usuário (ou o usuário autenticado, se omitido) tem permissão para usar o módulo Gallery, consultando a SOT no banco.",
  input: CheckGalleryAccessInputSchema,
  output: CheckGalleryAccessOutputSchema,
  permissions: [], // self-check: a própria RPC valida ownership
  costHint: "cheap",
  examples: [
    { nl: "Posso usar a Gallery agora?", input: {} },
  ],
  async handler(input, ctx) {
    let userId = input.userId ?? ctx.user?.id ?? null;
    if (!userId) {
      const { data: auth } = await supabase.auth.getUser();
      userId = auth?.user?.id ?? null;
    }
    if (!userId) {
      return err(
        domainError("UNAUTHENTICATED", "Sessão não encontrada. Faça login para continuar.", {
          retriable: false,
        }),
      );
    }

    const { data, error } = await supabase.rpc("user_has_gallery_access", { _user_id: userId });
    if (error) {
      ctx.log.error("rpc user_has_gallery_access falhou", { error });
      return err(
        domainError("INTERNAL", "Não foi possível verificar o acesso à Gallery.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    return ok({ hasAccess: Boolean(data), userId });
  },
});
