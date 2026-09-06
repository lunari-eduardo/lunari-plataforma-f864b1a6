import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { round2 } from "../../domain/calculo";

export const AVISO_CONGELAMENTO =
  "Alteração vale apenas para sessões novas — sessões existentes mantêm as regras de preço congeladas.";

export const DiffSchema = z.array(
  z.object({ campo: z.string(), de: z.string(), para: z.string() }),
);

export const ProdutoInputSchema = z.object({
  nome: z.string().optional(),
  custo: z.number(),
  quantidade: z.number().optional(),
});

export const CustoInputSchema = z.object({
  descricao: z.string().optional(),
  valorUnitario: z.number(),
  quantidade: z.number().optional(),
});

export function markupDaMargem(margemPercentual: number): number | null {
  const m = Number(margemPercentual) || 0;
  if (m <= 0 || m >= 100) return null;
  return round2(1 / (1 - m / 100));
}

export const somaProdutos = (l?: z.infer<typeof ProdutoInputSchema>[]) =>
  (l ?? []).reduce((s, p) => s + (Number(p.custo) || 0) * (Number(p.quantidade) || 1), 0);

export const somaCustos = (l?: z.infer<typeof CustoInputSchema>[]) =>
  (l ?? []).reduce((s, c) => s + (Number(c.valorUnitario) || 0) * (Number(c.quantidade) || 1), 0);

export async function ensurePricingConfigId(userId: string): Promise<string> {
  const { data } = await supabase.from("pricing_configuracoes").select("id").maybeSingle();
  if (data?.id) return data.id as string;
  const { data: created, error } = await supabase
    .from("pricing_configuracoes")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}
