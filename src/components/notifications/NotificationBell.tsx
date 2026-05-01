import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationList } from './NotificationList';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    countByCategory,
    isRead,
    markAsRead,
    markAllAsRead,
    dismiss,
  } = useNotifications();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 hover:bg-muted/50"
          aria-label="Notificações"
        >
          <Bell className="h-3.5 w-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-2xs rounded-full h-4 min-w-4 px-1 flex items-center justify-center font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0 backdrop-blur-xl bg-background/95 border-border/50 shadow-xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
            <p className="text-2xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'}`
                : 'Tudo em dia'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-2xs text-primary hover:underline"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        <NotificationList
          notifications={notifications}
          countByCategory={countByCategory}
          isRead={isRead}
          onMarkRead={markAsRead}
          onDismiss={dismiss}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
