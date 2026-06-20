import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useInternalNotes } from "../../hooks/useInternalNotes";
import { addNote, deleteNote } from "../../services/internalNotes.service";
import { useSupportHost } from "../../SupportHostProvider";
import { X } from "lucide-react";

export function InternalNotesPanel({ ticketId }: { ticketId: string }) {
  const host = useSupportHost();
  const { notes, refresh } = useInternalNotes(ticketId);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const trimmed = body.trim();
    if (!trimmed || !host.currentUser) return;
    setSaving(true);
    setBody("");
    try {
      await addNote(host.supabase, { ticketId, authorId: host.currentUser.id, body: trimmed });
      await refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Erro ao salvar nota");
      setBody(trimmed);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote(host.supabase, id);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir nota");
    }
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">
          Notas internas (apenas admins)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notes.map((n) => (
          <div
            key={n.id}
            className="group flex items-start justify-between gap-2 rounded-md border border-amber-500/20 bg-background/60 p-2 text-xs"
          >
            <div className="space-y-1">
              <div className="text-[10px] uppercase text-muted-foreground">
                {format(new Date(n.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </div>
              <p className="whitespace-pre-wrap break-words">{n.body}</p>
            </div>
            <button
              onClick={() => handleDelete(n.id)}
              className="text-muted-foreground opacity-0 transition group-hover:opacity-100"
              aria-label="Excluir nota"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Nota interna…"
          rows={2}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} disabled={saving || !body.trim()}>
            Adicionar nota
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
