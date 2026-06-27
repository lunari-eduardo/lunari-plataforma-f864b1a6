/**
 * Public barrel do módulo Tasks.
 * Onda 2: expõe domínio, store, ports, repos Supabase e bridge realtime único.
 */

export * from "./domain/types";
export * from "./domain/events";
export * from "./domain/rules";
export * from "./domain/selectors";
export { tasksStore } from "./presentation/store/tasksStore";
export type { TasksStore } from "./presentation/store/tasksStore";

// Ports (contratos)
export type { TasksRepo, ListTasksFilter } from "./ports/tasksRepo";
export type { StatusesRepo } from "./ports/statusesRepo";

// Infra (implementações Supabase)
export { supabaseTasksRepo } from "./infrastructure/supabase/tasksRepo";
export { supabaseStatusesRepo } from "./infrastructure/supabase/statusesRepo";
export { tasksRealtime } from "./infrastructure/realtime/tasksRealtimeChannel";
export { TasksRealtimeBridge } from "./infrastructure/realtime/TasksRealtimeBridge";
