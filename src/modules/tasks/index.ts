/**
 * Public barrel do módulo Tasks.
 * Onda 3: expõe domínio, store, ports, repos Supabase, bridge realtime e
 * capabilities (commands + queries) registrados no registry global.
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
export { AttachmentsRealtimeBridge } from "./infrastructure/realtime/AttachmentsRealtimeBridge";
export { attachmentsStore, useAttachmentsVersion } from "./presentation/store/attachmentsStore";
export { useTaskAttachmentsV2 } from "./presentation/hooks/useTaskAttachmentsV2";

// Registra eventos do módulo no LunariEvents (declaration merging)
import "./application/events";

// Capabilities — efeito colateral: registram-se no registry global
import "./application/commands/createTask";
import "./application/commands/updateTask";
import "./application/commands/moveTask";
import "./application/commands/completeTask";
import "./application/commands/reopenTask";
import "./application/commands/deleteTask";
import "./application/commands/snoozeTask";
import "./application/commands/assignTask";
import "./application/commands/tags";
import "./application/commands/people";
import "./application/commands/attachments";
import "./application/queries/listAttachments";
import "./application/queries/listTasks";
import "./application/queries/getTaskById";
import "./application/queries/dueOverview";
import "./application/queries/countsByStatus";
import "./application/queries/searchTasks";
import "./application/queries/listTags";
import "./application/queries/listPeople";

// Re-export para uso direto via TanStack hooks ou execute()
export { createTask } from "./application/commands/createTask";
export { updateTask } from "./application/commands/updateTask";
export { moveTask } from "./application/commands/moveTask";
export { completeTask } from "./application/commands/completeTask";
export { reopenTask } from "./application/commands/reopenTask";
export { deleteTask } from "./application/commands/deleteTask";
export { snoozeTask } from "./application/commands/snoozeTask";
export { assignTask } from "./application/commands/assignTask";
export { listTasks } from "./application/queries/listTasks";
export { getTaskById } from "./application/queries/getTaskById";
export { dueOverview } from "./application/queries/dueOverview";
export { countsByStatusQuery } from "./application/queries/countsByStatus";
export { searchTasks } from "./application/queries/searchTasks";
export { createTag, updateTag, deleteTag, reorderTags } from "./application/commands/tags";
export { createPerson, updatePerson, deletePerson, reorderPeople } from "./application/commands/people";
export { listTags } from "./application/queries/listTags";
export { listPeople } from "./application/queries/listPeople";
export { addTaskAttachment, removeTaskAttachment } from "./application/commands/attachments";
export { listTaskAttachments } from "./application/queries/listAttachments";

