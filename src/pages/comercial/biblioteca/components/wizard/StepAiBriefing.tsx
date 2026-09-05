import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { UploadCloud, Loader2, X, Image as ImageIcon, FileText } from 'lucide-react';
import { SESSION_TYPES, TONES, Categoria, AiRef } from '../../types';
import { ProposalBriefing } from '@/hooks/useProposalAI';

interface StepAiBriefingProps {
  onBack: () => void;
  selectedCategoria: Categoria | null;
  setSelectedCategoria: (cat: Categoria | null) => void;
  categorias: Categoria[];
  isLoadingCategorias: boolean;
  customTitle: string;
  setCustomTitle: (title: string) => void;
  briefing: ProposalBriefing;
  setBriefing: React.Dispatch<React.SetStateAction<ProposalBriefing>>;
  profile: any;
  pacotes: any[];
  selectedPacoteIds: string[];
  setSelectedPacoteIds: React.Dispatch<React.SetStateAction<string[]>>;
  aiRefs: AiRef[];
  setAiRefs: React.Dispatch<React.SetStateAction<AiRef[]>>;
  isUploadingRef: boolean;
  addRefImages: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  addRefPdf: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  addRefText: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function StepAiBriefing({
  onBack,
  selectedCategoria,
  setSelectedCategoria,
  categorias,
  isLoadingCategorias,
  customTitle,
  setCustomTitle,
  briefing,
  setBriefing,
  profile,
  pacotes,
  selectedPacoteIds,
  setSelectedPacoteIds,
  aiRefs,
  setAiRefs,
  isUploadingRef,
  addRefImages,
  addRefPdf,
  addRefText,
}: StepAiBriefingProps) {
  return (
    <div className="py-4 space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground transition-colors underline underline-offset-2"
        >
          ← Voltar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Categoria *</label>
          {isLoadingCategorias ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : (
            <Select
              value={selectedCategoria?.id || ''}
              onValueChange={(val) => {
                const cat = categorias.find((c) => c.id === val) || null;
                setSelectedCategoria(cat);
                if (cat) setBriefing((b) => ({ ...b, session_type: cat.nome }));
              }}
            >
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Título da proposta (opcional)</label>
          <Input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder={selectedCategoria?.nome || 'Proposta'}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de sessão</label>
          <Select
            value={briefing.session_type}
            onValueChange={(v) => setBriefing((b) => ({ ...b, session_type: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_TYPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Tom da escrita</label>
          <Select
            value={briefing.tone || 'Acolhedor'}
            onValueChange={(v) => setBriefing((b) => ({ ...b, tone: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Nome do cliente (opcional)</label>
          <Input
            value={briefing.client_name || ''}
            onChange={(e) => setBriefing((b) => ({ ...b, client_name: e.target.value }))}
            placeholder="Ex: Mariana"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Seu nome / estúdio</label>
          <Input
            value={briefing.photographer_name || ''}
            onChange={(e) => setBriefing((b) => ({ ...b, photographer_name: e.target.value }))}
            placeholder="Ex: Camila Ramos Fotografias"
          />
          {profile?.empresa && (
            <p className="text-xs text-muted-foreground">Preenchido com o nome da sua conta.</p>
          )}
        </div>
      </div>

      {/* Pacotes cadastrados */}
      {(pacotes || []).length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Usar meus pacotes cadastrados (opcional)</label>
          <div className="flex flex-wrap gap-2">
            {(pacotes || []).map((p) => {
              const active = selectedPacoteIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setSelectedPacoteIds((ids) =>
                      active ? ids.filter((i) => i !== p.id) : [...ids, p.id]
                    )
                  }
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {p.nome}
                  {p.valor_base ? ` · R$ ${Number(p.valor_base).toLocaleString('pt-BR')}` : ''}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Selecionando pacotes, a IA usa nomes e preços reais em vez de inventar valores.
          </p>
        </div>
      )}

      {/* Referências de layout/design */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Referências de layout/design (opcional)</label>
        <p className="text-xs text-muted-foreground">
          Envie prints, imagens ou PDF de propostas que você gostou. A IA analisa estrutura,
          cores, tipografia e tom para gerar algo próximo da referência.
        </p>
        {aiRefs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {aiRefs.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs max-w-full"
              >
                {r.kind === 'image' ? (
                  <ImageIcon className="h-3 w-3 shrink-0 text-primary" />
                ) : (
                  <FileText className="h-3 w-3 shrink-0 text-primary" />
                )}
                <span className="truncate max-w-[160px]">{r.name}</span>
                <button
                  type="button"
                  onClick={() => setAiRefs((prev) => prev.filter((x) => x.id !== r.id))}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={addRefImages}
              disabled={isUploadingRef}
            />
            <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent">
              {isUploadingRef ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-3 w-3" />
              )}
              Imagens (até 6)
            </span>
          </label>
          <label>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={addRefPdf}
              disabled={isUploadingRef}
            />
            <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent">
              {isUploadingRef ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-3 w-3" />
              )}
              PDF (1)
            </span>
          </label>
          <label>
            <input
              type="file"
              accept=".txt,.md,text/plain"
              multiple
              className="hidden"
              onChange={addRefText}
              disabled={isUploadingRef}
            />
            <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent">
              <UploadCloud className="mr-2 h-3 w-3" />
              Texto (.txt/.md)
            </span>
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Imagens e textos funcionam com qualquer provedor; PDF exige o provedor Gemini.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Destaques e observações</label>
        <Textarea
          value={briefing.highlights || ''}
          onChange={(e) => setBriefing((b) => ({ ...b, highlights: e.target.value }))}
          placeholder="Ex: ensaio no estúdio com luz natural, 2 trocas de roupa, entrega em 10 dias, álbum incluso..."
          className="min-h-[90px]"
        />
        <p className="text-xs text-muted-foreground">
          A IA gera a estrutura e os textos. Depois você edita tudo normalmente no construtor.
        </p>
      </div>
    </div>
  );
}
