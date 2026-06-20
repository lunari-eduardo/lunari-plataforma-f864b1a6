import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useFAQList } from "../../hooks/useFAQ";
import { useSupportHost } from "../../SupportHostProvider";
import { upsertFAQ, deleteFAQ } from "../../services/faq.service";
import { FAQ_CATEGORY_LABEL } from "../../utils/labels";
import { SUPPORT_ROUTES } from "../../config";

export default function FAQManagerPage() {
  const host = useSupportHost();
  const navigate = useNavigate();
  const { articles, loading, refresh } = useFAQList(true);

  const togglePublished = async (id: string, current: boolean, payload: any) => {
    try {
      await upsertFAQ(host.supabase, { ...payload, published: !current });
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este artigo?")) return;
    try {
      await deleteFAQ(host.supabase, id);
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir");
    }
  };

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">FAQ</h1>
        <Button size="sm" onClick={() => navigate(SUPPORT_ROUTES.admin.faqNew)}>
          <Plus className="mr-2 h-3.5 w-3.5" /> Novo artigo
        </Button>
      </header>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Pergunta</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Publicado</th>
              <th className="px-3 py-2">Views</th>
              <th className="px-3 py-2">👍 / 👎</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && !articles.length && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">Carregando…</td></tr>
            )}
            {!loading && !articles.length && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum artigo.</td></tr>
            )}
            {articles.map((a) => (
              <tr key={a.id} className="border-t border-border/50 hover:bg-muted/30">
                <td className="cursor-pointer px-3 py-2 font-medium" onClick={() => navigate(SUPPORT_ROUTES.admin.faqEdit(a.id))}>
                  {a.pergunta}
                </td>
                <td className="px-3 py-2 text-xs">{FAQ_CATEGORY_LABEL[a.category]}</td>
                <td className="px-3 py-2">
                  <Switch
                    checked={a.published}
                    onCheckedChange={() => togglePublished(a.id, a.published, a)}
                  />
                </td>
                <td className="px-3 py-2 text-xs">{a.views_count}</td>
                <td className="px-3 py-2 text-xs">{a.helpful_count} / {a.not_helpful_count}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
