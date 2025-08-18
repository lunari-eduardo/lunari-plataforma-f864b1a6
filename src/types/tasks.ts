export type TaskStatus = string;
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeName?: string;
  createdAt: string; // ISO
  dueDate?: string;  // ISO
  tags?: string[];
  relatedClienteId?: string;
  relatedBudgetId?: string;
  relatedSessionId?: string;
  lastNotifiedAt?: string; // ISO
  snoozeUntil?: string;    // ISO
  source: 'automation' | 'manual';
  completedAt?: string; // ISO
  // New optional fields for checklist-type tasks
  type?: 'standard' | 'checklist';
  checked?: boolean;
  // Phase 1 extensions
  attachments?: TaskAttachment[];
  notes?: string;
  estimatedHours?: number;
  // Phase 2 extensions
  captions?: TaskCaption[];
}

export interface TaskAttachment {
  id: string;
  name: string;
  type: 'document' | 'image' | 'text';
  url?: string;
  content?: string; // For text attachments
  uploadedAt: string;
  size?: number;
  mimeType?: string;
}

export interface TaskCaption {
  id: string;
  title: string;
  content: string;
  hashtags?: string[];
  createdAt: string;
  platform?: 'instagram' | 'facebook' | 'general';
}

export interface TeamMember {
  id: string;
  name: string;
  color?: string;
  avatarInitials?: string;
}
