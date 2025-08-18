export type TaskStatus = string;
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskType = 'simple' | 'content' | 'checklist' | 'document';

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
  // Task type and specialized fields
  type: TaskType;
  checked?: boolean; // For checklist items
  checklistItems?: ChecklistItem[];
  callToAction?: string; // For content tasks
  socialPlatforms?: string[]; // For content tasks
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

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface TaskCaption {
  id: string;
  title: string;
  content: string;
  hashtags?: string[];
  createdAt: string;
  platform?: 'instagram' | 'facebook' | 'general';
  characterCount?: number;
}

export interface TeamMember {
  id: string;
  name: string;
  color?: string;
  avatarInitials?: string;
}
