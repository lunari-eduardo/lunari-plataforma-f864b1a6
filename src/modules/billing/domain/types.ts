import { z } from "zod";

export const ProviderSchema = z.enum(["asaas", "mercadopago", "infinitepay"]);
export type BillingProvider = z.infer<typeof ProviderSchema>;

export const CreateGalleryPaymentInputSchema = z
  .object({
    clienteId: z.string().uuid("clienteId deve ser um UUID"),
    valor: z.number().positive("valor deve ser maior que zero"),
    galleryId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    descricao: z.string().max(500).optional(),
  })
  .refine((v) => v.galleryId || v.sessionId, {
    message: "Informe galleryId ou sessionId",
    path: ["galleryId"],
  });

export type CreateGalleryPaymentInput = z.infer<typeof CreateGalleryPaymentInputSchema>;

export const CreateGalleryPaymentOutputSchema = z.object({
  cobrancaId: z.string().uuid(),
  provider: ProviderSchema,
  paymentUrl: z.string().url().nullable(),
  reused: z.boolean(),
});

export type CreateGalleryPaymentOutput = z.infer<typeof CreateGalleryPaymentOutputSchema>;
