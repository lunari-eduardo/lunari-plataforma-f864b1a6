// Configurações centralizadas do módulo de Suporte.
// Mantenha aqui qualquer constante que possa precisar virar tabela/config no futuro.

export const SUPPORT_WHATSAPP_NUMBER = "5551998287948"; // +55 51 99828-7948

export const SUPPORT_LIMITS = {
  maxFilesPerMessage: 5,
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 50 * 1024 * 1024,
  acceptedImageMimes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  acceptedVideoMimes: ["video/mp4", "video/webm", "video/quicktime"],
};

export const SUPPORT_ROUTES = {
  user: {
    home: "/app/suporte",
    ticket: (id: string) => `/app/suporte/chamado/${id}`,
  },
  admin: {
    dashboard: "/app/admin/suporte",
    tickets: "/app/admin/suporte/chamados",
    ticket: (id: string) => `/app/admin/suporte/chamados/${id}`,
    faq: "/app/admin/suporte/faq",
    faqNew: "/app/admin/suporte/faq/novo",
    faqEdit: (id: string) => `/app/admin/suporte/faq/${id}`,
  },
};

export function isAcceptedMime(mime: string) {
  return (
    SUPPORT_LIMITS.acceptedImageMimes.includes(mime) ||
    SUPPORT_LIMITS.acceptedVideoMimes.includes(mime)
  );
}

export function kindForMime(mime: string): "image" | "video" | null {
  if (SUPPORT_LIMITS.acceptedImageMimes.includes(mime)) return "image";
  if (SUPPORT_LIMITS.acceptedVideoMimes.includes(mime)) return "video";
  return null;
}
