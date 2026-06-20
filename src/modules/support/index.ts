// API pública do módulo de Suporte. Para extrair para outro app, copie a pasta
// inteira e implemente um SupportHostProvider apontando para o supabase/storage
// do novo host.

export { SupportHostProvider, useSupportHost } from "./SupportHostProvider";
export type { SupportHost, SupportHostStorage } from "./SupportHostProvider";
export { SupportUserRoutes, SupportAdminRoutes } from "./routes/SupportRoutes";
export * from "./types";
export * from "./config";
