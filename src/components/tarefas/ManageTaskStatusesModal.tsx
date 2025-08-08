import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { useMemo, useState } from 'react';

export default function ManageTaskStatusesModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void; }) {
  const { statuses, addStatus, updateStatus, removeStatus, moveStatus } = useTaskStatuses();
  const [newName, setNewName] = useState('');

  const canDelete = useMemo(() => {
    const doneCount = statuses.filter(s => s.isDone).length;
    return (id: string) => {
      const target = statuses.find(s => s.id === id);
      if (!target) return false;
      if (target.isDone && doneCount <= 1) return false;
      return true;
    };
  }, [statuses]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Gerenciar status</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            {statuses.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-2">
                <Input
                  value={s.name}
                  onChange={(e) => updateStatus(s.id, { name: e.target.value })}
                  className="flex-1"
                />
                <Switch
                  checked={!!s.isDone}
                  onCheckedChange={(v) => updateStatus(s.id, { isDone: v })}
                />
                <Label className="text-2xs">Concluído</Label>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStatus(s.id, 'up')} disabled={idx === 0}>↑</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStatus(s.id, 'down')} disabled={idx === statuses.length - 1}>↓</Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => canDelete(s.id) && removeStatus(s.id)}
                  disabled={!canDelete(s.id)}
                  title={canDelete(s.id) ? 'Remover' : 'Não é possível remover o único status de concluído'}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              addStatus(newName.trim());
              setNewName('');
            }}
            className="flex items-center gap-2"
          >
            <Input placeholder="Novo status" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button type="submit">Adicionar</Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
