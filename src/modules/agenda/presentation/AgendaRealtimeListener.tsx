/**
 * Listener React que conecta o realtime do módulo Agenda ao `eventBus`.
 *
 * Monte UMA vez perto da raiz (dentro do `AuthProvider`, junto ao
 * `AgendaInvalidationBridge`). Reabre as inscrições quando o usuário muda.
 */
import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeAgendaRealtime } from "../infrastructure/realtime";

export const AgendaRealtimeListener: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id;

  React.useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeAgendaRealtime(userId);
    return () => {
      unsubscribe();
    };
  }, [userId]);

  return null;
};
