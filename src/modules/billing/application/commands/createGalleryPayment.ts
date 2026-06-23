import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import {
  CreateGalleryPaymentInputSchema,
  CreateGalleryPaymentOutputSchema,
  ProviderSchema,
} from "../../domain/types";

/**
 * Capability `billing.createGalleryPayment`
 *
 * Cria (ou reaproveita) uma cobrança no provedor de pagamento padrão do
 * fotógrafo para uma galeria/sessão. Encapsula a edge function homônima
 * desenhada na Onda A, agregando:
 *   - validação Zod do contrato;
 *   - autorização declarativa (`billing:create`);
 *   - idempotência fim-a-fim (10 min) reforçada pelo hash da entrada;
 *   - emissão do evento `billing.charge_created` para o Workflow reagir.
 *
 * É a fonte única usada por Web, Mobile, Assistente Lunari e integrações.
 */
export const createGalleryPayment = defineCommand({
  id: "billing.createGalleryPayment",
  title: "Criar cobrança da galeria",
  description:
    "Gera link de pagamento (Asaas/Mercado Pago/InfinitePay) para uma galeria ou sessão respeitando o provedor padrão do fotógrafo.",
  input: CreateGalleryPaymentInputSchema,
  output: CreateGalleryPaymentOutputSchema,
  permissions: ["billing:create"],
  sideEffects: [
    "db:cobrancas",
    "external:asaas",
    "external:mercadopago",
    "external:infinitepay",
    "event:billing.charge_created",
  ],
  costHint: "medium",
  audit: "on-success",
  idempotencyKey: (input) =>
    [
      "billing.createGalleryPayment",
      input.clienteId,
      input.sessionId ?? "-",
      input.galleryId ?? "-",
      input.valor.toFixed(2),
    ].join(":"),
  examples: [
    {
      nl: "Cobrar R$ 120,00 da cliente Maria pelas fotos extras desta sessão",
      input: {
        clienteId: "00000000-0000-0000-0000-000000000000",
        sessionId: "00000000-0000-0000-0000-000000000001",
        valor: 120,
      },
    },
  ],
  async handler(input, ctx) {
    const { data, error } = await supabase.functions.invoke("gallery-create-payment", {
      body: input,
    });

    if (error) {
      ctx.log.error("edge function falhou", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível criar a cobrança no provedor.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    if (!data || data.success === false) {
      const code = data?.code ?? "EXTERNAL";
      const message = data?.error ?? "Falha ao criar cobrança.";
      // 403 NO_GALLERY_ACCESS vira erro de autorização tipado
      if (code === "NO_GALLERY_ACCESS") {
        return err(domainError("FORBIDDEN", message, { retriable: false }));
      }
      return err(domainError(code, message, { retriable: false, details: data }));
    }

    const provider = ProviderSchema.parse(data.provider);
    const output = {
      cobrancaId: data.cobrancaId as string,
      provider,
      paymentUrl: (data.paymentUrl ?? null) as string | null,
      reused: Boolean(data.reused),
    };

    await ctx.emit("billing.charge_created", {
      cobrancaId: output.cobrancaId,
      provider,
      photographerId: data.photographerId as string,
      clienteId: input.clienteId,
      sessionId: input.sessionId ?? null,
      galleryId: input.galleryId ?? null,
      valor: input.valor,
      paymentUrl: output.paymentUrl,
      reused: output.reused,
    });

    return ok(output);
  },
});
