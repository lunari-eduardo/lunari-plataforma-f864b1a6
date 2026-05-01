import { Inbox } from 'lucide-react';

export function NotificationEmptyState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="p-3 rounded-full bg-muted/30 mb-3">
        <Inbox className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground">
        {message || 'Tudo em dia. Nenhuma notificação.'}
      </p>
    </div>
  );
}
