/**
 * SupportHostProvider — único ponto de acoplamento entre o módulo de Suporte e
 * o app que o hospeda. Para extrair o módulo para outro app, basta implementar
 * este contrato com o supabase client/admin/storage do novo host.
 */
import React, { createContext, useContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SupportHostStorage {
  uploadFile(
    file: File,
    opts: { context: "support-ticket" | "support-faq"; entityId: string }
  ): Promise<{ r2Key: string; url?: string }>;
  getSignedUrl(r2Key: string, expiresIn?: number): Promise<string | null>;
  publicUrl(r2Key: string): string;
  deleteFile(r2Key: string): Promise<void>;
}

export interface SupportHost {
  supabase: SupabaseClient;
  currentUser: { id: string; email?: string | null; name?: string | null } | null;
  isAdmin: boolean;
  plan?: { id?: string | null; label?: string | null } | null;
  appVersion?: string;
  storage: SupportHostStorage;
}

const SupportHostContext = createContext<SupportHost | null>(null);

export function SupportHostProvider({
  value,
  children,
}: {
  value: SupportHost;
  children: React.ReactNode;
}) {
  return <SupportHostContext.Provider value={value}>{children}</SupportHostContext.Provider>;
}

export function useSupportHost(): SupportHost {
  const ctx = useContext(SupportHostContext);
  if (!ctx) throw new Error("useSupportHost deve ser usado dentro de SupportHostProvider");
  return ctx;
}
