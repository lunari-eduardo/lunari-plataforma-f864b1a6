export type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  createdAt: string; // ISO
  dueDate?: string;  // ISO
  tags?: string[];
  relatedClienteId?: string;
  relatedBudgetId?: string;
  relatedSessionId?: string;
  lastNotifiedAt?: string; // ISO
  snoozeUntil?: string;    // ISO
  source: 'automation' | 'manual';
}

export interface TeamMember {
  id: string;
  name: string;
  color?: string;
  avatarInitials?: string;
}
