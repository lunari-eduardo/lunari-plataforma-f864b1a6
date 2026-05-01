import { NotificationState } from '@/types/notifications';

const STORAGE_PREFIX = 'notif_state_';
const MAX_STORED_IDS = 500; // cap to avoid unbounded growth

const empty = (): NotificationState => ({
  readIds: [],
  dismissedIds: [],
  lastSeenAt: null,
});

const keyFor = (userId: string) => `${STORAGE_PREFIX}${userId}`;

export const NotificationStateService = {
  load(userId: string): NotificationState {
    if (!userId) return empty();
    try {
      const raw = localStorage.getItem(keyFor(userId));
      if (!raw) return empty();
      const parsed = JSON.parse(raw);
      return {
        readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
        dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
        lastSeenAt: parsed.lastSeenAt ?? null,
      };
    } catch {
      return empty();
    }
  },

  save(userId: string, state: NotificationState): void {
    if (!userId) return;
    try {
      const trimmed: NotificationState = {
        readIds: state.readIds.slice(-MAX_STORED_IDS),
        dismissedIds: state.dismissedIds.slice(-MAX_STORED_IDS),
        lastSeenAt: state.lastSeenAt,
      };
      localStorage.setItem(keyFor(userId), JSON.stringify(trimmed));
    } catch {
      // ignore quota / serialization errors
    }
  },

  markRead(userId: string, id: string): NotificationState {
    const cur = this.load(userId);
    if (cur.readIds.includes(id)) return cur;
    const next = { ...cur, readIds: [...cur.readIds, id] };
    this.save(userId, next);
    return next;
  },

  markAllRead(userId: string, ids: string[]): NotificationState {
    const cur = this.load(userId);
    const set = new Set([...cur.readIds, ...ids]);
    const next = { ...cur, readIds: Array.from(set), lastSeenAt: new Date().toISOString() };
    this.save(userId, next);
    return next;
  },

  dismiss(userId: string, id: string): NotificationState {
    const cur = this.load(userId);
    if (cur.dismissedIds.includes(id)) return cur;
    const next = { ...cur, dismissedIds: [...cur.dismissedIds, id] };
    this.save(userId, next);
    return next;
  },

  setLastSeen(userId: string): NotificationState {
    const cur = this.load(userId);
    const next = { ...cur, lastSeenAt: new Date().toISOString() };
    this.save(userId, next);
    return next;
  },
};
