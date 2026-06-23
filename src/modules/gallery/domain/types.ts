import { z } from "zod";

export const CheckGalleryAccessInputSchema = z.object({
  userId: z.string().uuid().optional(),
});
export type CheckGalleryAccessInput = z.infer<typeof CheckGalleryAccessInputSchema>;

export const CheckGalleryAccessOutputSchema = z.object({
  hasAccess: z.boolean(),
  userId: z.string().uuid(),
});
export type CheckGalleryAccessOutput = z.infer<typeof CheckGalleryAccessOutputSchema>;
