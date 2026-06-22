/**
 * Implementação de AvailabilityRepository — fala direto com Supabase.
 * Onda 7e1: removida a delegação para `SupabaseAgendaAdapter`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AvailabilitySlot, NewAvailabilitySlot } from "../domain/types";
import type { AvailabilityRepository } from "../domain/ports.availability";
import type { AvailabilityTypesRepository } from "../domain/ports.availabilityTypes";
import { SupabaseAvailabilityTypesRepository } from "./availabilityTypes.supabase";

const LABEL_FALLBACK: Record<string, string> = {
  disponivel: "Disponível",
  almoco: "Almoço",
  reuniao: "Reunião",
};

const COLOR_FALLBACK: Record<string, string> = {
  disponivel: "#10b981",
  almoco: "#f59e0b",
  reuniao: "#3b82f6",
};

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function calcEndTime(start: string, duration: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + duration;
  const eh = Math.floor(total / 60);
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) throw new Error("Usuário não autenticado");
  return data.session.user.id;
}

export class SupabaseAvailabilityRepository implements AvailabilityRepository {
  constructor(
    private readonly types: AvailabilityTypesRepository = new SupabaseAvailabilityTypesRepository(),
  ) {}

  async list(): Promise<AvailabilitySlot[]> {
    let userId: string;
    try {
      userId = await requireUserId();
    } catch {
      console.warn("⚠️ Usuário não autenticado");
      return [];
    }

    const { data, error } = await supabase
      .from("availability_slots")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("❌ Erro ao carregar availability slots:", error);
      throw error;
    }

    const types = await this.types.list();

    return (data || []).map((slot) => {
      const matching = types.find(
        (t) => t.id === slot.type || t.name.toLowerCase() === slot.type?.toLowerCase(),
      );
      const typeKey = slot.type ?? "disponivel";
      return {
        id: slot.id,
        date: slot.date,
        time: slot.start_time,
        duration: calcDuration(slot.start_time, slot.end_time),
        typeId: typeKey,
        label: slot.description || matching?.name || LABEL_FALLBACK[typeKey] || typeKey,
        color:
          (slot as any).color || matching?.color || COLOR_FALLBACK[typeKey] || "#10b981",
        isFullDay: (slot as any).is_full_day || false,
        fullDayDescription: (slot as any).full_day_description || undefined,
      } satisfies AvailabilitySlot;
    });
  }

  async addMany(slots: NewAvailabilitySlot[]): Promise<void> {
    const userId = await requireUserId();
    const payload = slots.map((slot) => ({
      user_id: userId,
      date: slot.date,
      start_time: slot.time,
      end_time: calcEndTime(slot.time, slot.duration || 60),
      type: slot.typeId || "disponivel",
      description: slot.label || null,
      color: slot.color || null,
      is_full_day: slot.isFullDay || false,
      full_day_description: slot.fullDayDescription || null,
    }));

    const { error } = await supabase.from("availability_slots").insert(payload);
    if (error) {
      console.error("❌ Erro ao adicionar availability slots:", error);
      throw error;
    }
  }

  async clearForDate(date: string): Promise<void> {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("availability_slots")
      .delete()
      .eq("date", date)
      .eq("user_id", userId);

    if (error) {
      console.error("❌ Erro ao limpar slots da data:", error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const userId = await requireUserId();
    const { error } = await supabase
      .from("availability_slots")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("❌ Erro ao deletar slot:", error);
      throw error;
    }
  }
}
