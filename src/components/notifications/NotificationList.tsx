import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { NotificationItem } from './NotificationItem';
import { NotificationEmptyState } from './NotificationEmptyState';
import { AppNotification, NotificationCategory } from '@/types/notifications';
import { cn } from '@/lib/utils';

type TabKey = 'all' | NotificationCategory;

interface Props {
  notifications: AppNotification[];
  countByCategory: Record<NotificationCategory | 'all', number>;
  isRead: (id: string) => boolean;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'pendencia', label: 'Pendências' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'cliente', label: 'Clientes' },
  { key: 'documento', label: 'Docs' },
];

export function NotificationList({
  notifications,
  countByCategory,
  isRead,
  onMarkRead,
  onDismiss,
  onClose,
}: Props) {
  const [tab, setTab] = useState<TabKey>('all');

  const filtered = useMemo(() => {
    if (tab === 'all') return notifications;
    return notifications.filter((n) => n.category === tab);
  }, [tab, notifications]);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
      <div className="px-2 pt-2">
        <TabsList className="w-full h-8 bg-muted/40 p-0.5">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="flex-1 text-2xs h-7 data-[state=active]:bg-background"
            >
              {t.label}
              {countByCategory[t.key] > 0 && (
                <span className={cn(
                  'ml-1.5 text-2xs px-1 rounded',
                  tab === t.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
                )}>
                  {countByCategory[t.key]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value={tab} className="mt-0 max-h-[480px] overflow-y-auto">
        {filtered.length === 0 ? (
          <NotificationEmptyState />
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                isRead={isRead(n.id)}
                onMarkRead={onMarkRead}
                onDismiss={onDismiss}
                onClose={onClose}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
