import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { MarkdownEditor } from "../shared/MarkdownEditor";
import { useSupportHost } from "../../SupportHostProvider";
import { upsertFAQ, getFAQById } from "../../services/faq.service";
import { FAQ_CATEGORY_LABEL, slugify } from "../../utils/labels";
import { SUPPORT_ROUTES } from "../../config";
import type { FAQArticle, FAQCategory } from "../../types";

const CATS: FAQCategory[] = [
  "conta", "galerias", "lunari_studio", "lunari_gallery",
  "financeiro", "assinatura", "configuracoes", "outros",
];

export default function FAQEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "novo";
  const host = useSupportHost();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [pergunta, setPergunta] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState<FAQCategory>("outros");
  const [resposta, setResposta] = useState("");
  const [keywords, setKeywords] = useState("");
  const [ordem, setOrdem] = useState(0);
  const [published, setPublished] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const a = await getFAQById(host.supabase, id!);
        if (!a || cancelled) return;
        setPergunta(a.pergunta);
        setSlug(a.slug);
        setCategory(a.category);
        setResposta(a.resposta);
        setKeywords(a.keywords.join(", "));
        setOrdem(a.ordem);
        setPublished(a.published);
        setActive(a.active);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [host, id, isNew]);

  const handleSave = async () => {
    if (!pergunta.trim() || !resposta.trim()) {
      toast.error("Pergunta e resposta obrigatórias");
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertFAQ(host.supabase, {
        id: isNew ? undefined : id,
        slug: slug || slugify(pergunta),
        category,
        pergunta: pergunta.trim(),
        resposta: resposta.trim(),
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        media: [],
        ordem: Number(ordem) || 0,
        published,
        active,
      });
      if (isNew) navigate(SUPPORT_ROUTES.admin.faqEdit(saved.id));
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(SUPPORT_ROUTES.admin.faq)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">{isNew ? "Novo artigo" : "Editar artigo"}</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Categoria</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as FAQCategory)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATS.map((c) => (<SelectItem key={c} value={c}>{FAQ_CATEGORY_LABEL[c]}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="h-9" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Pergunta</Label>
        <Input
          value={pergunta}
          onChange={(e) => {
            setPergunta(e.target.value);
            if (isNew && !slug) setSlug(slugify(e.target.value));
          }}
          className="h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Resposta (markdown)</Label>
        <MarkdownEditor value={resposta} onChange={setResposta} rows={12} maxLength={10000} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Palavras-chave (separadas por vírgula)</Label>
          <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Ordem</Label>
          <Input
            type="number"
            value={ordem}
            onChange={(e) => setOrdem(Number(e.target.value))}
            className="h-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 pt-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={published} onCheckedChange={setPublished} />
          Publicado
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={active} onCheckedChange={setActive} />
          Ativo
        </label>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
      </div>
    </div>
  );
}
