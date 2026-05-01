export type NotificationCategory =
  | 'pendencia'
  | 'financeiro'
  | 'cliente'
  | 'documento'
  | 'agenda';

export type NotificationPriority = 'critica' | 'alta' | 'media' | 'baixa';

export interface AppNotification {
  /** Deterministic ID — encodes source + entity so it survives refetch */
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  description?: string;
  /** ISO date string used for sort/relative time */
  timestamp: string;
  /** Optional route to navigate when clicked */
  route?: string;
  /** Lucide icon name (resolved in NotificationItem) */
  icon: 'bell' | 'dollar' | 'package' | 'user' | 'fileText' | 'calendar' | 'check' | 'gift' | 'inbox';
}

export interface NotificationState {
  readIds: string[];
  dismissedIds: string[];
  lastSeenAt: string | null;
}
