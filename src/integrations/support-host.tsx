/**
 * Implementação do SupportHost para o app Lunari.
 *
 * Este é o ÚNICO arquivo de acoplamento entre o módulo isolado em
 * `src/modules/support/**` e o Lunari. Para extrair o módulo para outro app
 * (ex: painel admin separado), basta criar um arquivo equivalente apontando
 * para o supabase/storage do novo host.
 */
import React, { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/hooks/useAccessControl";
import { SupportHostProvider } from "@/modules/support";
import type { SupportHost, SupportHostStorage } from "@/modules/support";

const R2_CDN_BASE = "https://media.lunarihub.com";

const storage: SupportHostStorage = {
  async uploadFile(file, opts) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("context", opts.context);
    fd.append("entityId", opts.entityId);
    const { data, error } = await supabase.functions.invoke("gestao-r2-upload", { body: fd });
    if (error) {
      let detail = error.message || "Erro no upload";
      try {
        const ctx: any = (error as any).context;
        if (ctx?.json) {
          const body = await ctx.json();
          if (body?.error) detail = String(body.error);
        }
      } catch {}
      throw new Error(detail);
    }
    if (!data?.success) throw new Error(data?.error || "Upload falhou");
    return { r2Key: data.storagePath as string, url: data.url || undefined };
  },
  async getSignedUrl(r2Key, expiresIn = 300) {
    // Anexos de FAQ são públicos
    if (r2Key.startsWith("gestao/support/faq/")) return `${R2_CDN_BASE}/${r2Key}`;
    const { data, error } = await supabase.functions.invoke("gestao-r2-signed-url", {
      body: { storagePath: r2Key, expiresIn },
    });
    if (error || !data?.url) return null;
    return data.url as string;
  },
  publicUrl(r2Key) {
    return `${R2_CDN_BASE}/${r2Key}`;
  },
  async deleteFile(r2Key) {
    await supabase.functions.invoke("gestao-r2-delete", { body: { storagePath: r2Key } });
  },
};

export function LunariSupportHostProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { accessState } = useAccessControl();

  const value = useMemo<SupportHost>(
    () => ({
      supabase,
      currentUser: user
        ? {
            id: user.id,
            email: user.email ?? null,
            name: (user.user_metadata as any)?.nome ?? null,
          }
        : null,
      isAdmin: !!accessState.isAdmin,
      plan: accessState.planName
        ? { id: accessState.planCode, label: accessState.planName }
        : null,
      appVersion: import.meta.env.VITE_APP_VERSION as string | undefined,
      storage,
    }),
    [user, accessState.isAdmin, accessState.planName, accessState.planCode]
  );

  return <SupportHostProvider value={value}>{children}</SupportHostProvider>;
}
