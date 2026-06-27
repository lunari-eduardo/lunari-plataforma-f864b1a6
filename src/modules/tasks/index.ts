/**
 * Public barrel do módulo Tasks.
 * Onda 1: expõe apenas domínio + store. Repos, capabilities e UI chegam nas próximas ondas.
 */

export * from "./domain/types";
export * from "./domain/events";
export * from "./domain/rules";
export * from "./domain/selectors";
export { tasksStore } from "./presentation/store/tasksStore";
export type { TasksStore } from "./presentation/store/tasksStore";
