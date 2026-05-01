import { useNavigate } from 'react-router-dom';
import {
  Bell,
  DollarSign,
  Package,
  User,
  FileText,
  Calendar,
  Check,
  Gift,
  Inbox,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppNotification, NotificationPriority } from '@/types/notifications';
import { cn } from '@/lib/utils';

const ICONS = {
  bell: Bell,
  dollar: DollarSign,
  package: Package,
  user: User,
  fileText: FileText,
  calendar: Calendar,
  check: Check,
  gift: Gift,
  inbox: Inbox,
};

const PRIORITY_DOT: Record<NotificationPriority, string> = {
  critica: 'bg-destructive',
  alta: 'bg-amber-500',
  media: 'bg-primary',
  baixa: 'bg-muted-foreground',
};

const PRIORITY_ICON_BG: Record<NotificationPriority, string> = {
  critica: 'bg-destructive/15 text-destructive',
  alta: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  media: 'bg-primary/15 text-primary',
  baixa: 'bg-muted text-muted-foreground',
};

interface Props {
  notification: AppNotification;
  isRead: boolean;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}

export function NotificationItem({
  notification,
  isRead,
  onMarkRead,
  onDismiss,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const Icon = ICONS[notification.icon] || Bell;

  const handleClick = () => {
    onMarkRead(notification.id);
    if (notification.route) {
      navigate(notification.route);
      onClose();
    }
  };

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(notification.timestamp), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return '';
    }
  })();

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
        'hover:bg-muted/40',
        !isRead && 'bg-primary/[0.03]'
      )}
      onClick={handleClick}
    >
      {/* Unread dot */}
      <div className="flex-shrink-0 pt-1.5">
        <span
          className={cn(
            'block h-2 w-2 rounded-full transition-opacity',
            isRead ? 'bg-transparent' : PRIORITY_DOT[notification.priority]
          )}
        />
      </div>

      {/* Category icon */}
      <div
        className={cn(
          'flex-shrink-0 p-1.5 rounded-lg',
          PRIORITY_ICON_BG[notification.priority]
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs leading-tight',
          isRead ? 'text-muted-foreground font-normal' : 'text-foreground font-medium'
        )}>
          {notification.title}
        </p>
        {notification.description && (
          <p className="text-2xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.description}
          </p>
        )}
        <p className="text-2xs text-muted-foreground/70 mt-1">{timeAgo}</p>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        aria-label="Dispensar"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
