import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContratoRichEditor } from './ContratoRichEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useContratoTemplates } from '@/hooks/useContratoTemplates';
import { useContratos } from '@/hooks/useContratos';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { applyVariables, buildVariableMap, VARIAVEIS_DISPONIVEIS } from '@/utils/contratoVariables';
import { Sparkles, FileText } from 'lucide-react';

interface NovoContratoModalProps {
  open: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome?: string;
  /** sessionId opcional: ao informar, contrato fica vinculado à sessão */
  sessionId?: string;
}

interface SessaoOpcao {
  id: string;
  session_id: string;
  data_sessao: string;
  hora_sessao: string;
  categoria: string;
  pacote: string | null;
  descricao: string | null;
  valor_total: number | null;
}

export function NovoContratoModal({ open, onClose, clienteId, clienteNome, sessionId }: NovoContratoModalProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { templates } = useContratoTemplates();
  const { create } = useContratos({ clienteId });

  const [step, setStep] = useState<'select' | 'edit'>('select');
  const [templateId, setTemplateId] = useState<string>('');
  const [sessaoSelecionada, setSessaoSelecionada] = useState<string>(sessionId || '');
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [sessoes, setSessoes] = useState<SessaoOpcao[]>([]);
  const [cliente, setCliente] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setStep('select');
      setTemplateId(templates.find((t) => t.is_padrao)?.id || templates[0]?.id || '');
      setSessaoSelecionada(sessionId || '');
      setTitulo('');
      setConteudo('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Carregar dados do cliente e suas sessões
  useEffect(() => {
    if (!open || !clienteId) return;
    (async () => {
      const [cli, sess] = await Promise.all([
        supabase.from('clientes').select('id, nome, email, telefone, whatsapp, endereco').eq('id', clienteId).single(),
        supabase
          .from('clientes_sessoes')
          .select('id, session_id, data_sessao, hora_sessao, categoria, pacote, descricao, valor_total')
          .eq('cliente_id', clienteId)
          .order('data_sessao', { ascending: false }),
      ]);
      setCliente(cli.data);
      setSessoes((sess.data as any) || []);
    })();
  }, [open, clienteId]);

  const sessaoSel = useMemo(
    () => sessoes.find((s) => s.session_id === sessaoSelecionada || s.id === sessaoSelecionada),
    [sessoes, sessaoSelecionada]
  );

  const variaveis = useMemo(
    () =>
      buildVariableMap({
        cliente,
        sessao: sessaoSel
          ? {
              data_sessao: sessaoSel.data_sessao,
              hora_sessao: sessaoSel.hora_sessao,
              categoria: sessaoSel.categoria,
              pacote: sessaoSel.pacote,
              descricao: sessaoSel.descricao,
              valor_total: sessaoSel.valor_total,
            }
          : null,
        fotografo: {
          nome: (profile as any)?.nome || (profile as any)?.empresa || user?.email,
          email: (profile as any)?.email || user?.email,
          cidade: (profile as any)?.cidade_nome
            ? `${(profile as any).cidade_nome}${(profile as any).cidade_uf ? ` - ${(profile as any).cidade_uf}` : ''}`
            : (profile as any)?.cidade || '',
          documento: (profile as any)?.cpf_cnpj || '',
        },
      }),
    [cliente, sessaoSel, profile, user]
  );

  const handleGerar = () => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const conteudoFinal = applyVariables(tpl.conteudo, variaveis);
    setConteudo(conteudoFinal);
    setTitulo(`${tpl.nome}${cliente?.nome ? ` — ${cliente.nome}` : ''}`);
    setStep('edit');
  };

  const handleSalvar = async () => {
    if (!titulo.trim() || !conteudo.trim()) return;
    setSaving(true);
    try {
      await create({
        cliente_id: clienteId,
        session_id: sessaoSelecionada || null,
        template_id: templateId || null,
        titulo,
        conteudo,
        variaveis_snapshot: variaveis,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{step === 'select' ? 'Novo contrato' : 'Revisar e ajustar contrato'}</DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? `Escolha o modelo${sessionId ? '' : ' e a sessão a vincular (opcional)'}.`
              : 'Variáveis foram substituídas. Revise antes de salvar como rascunho.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-4 flex-1 overflow-y-auto">
            {templates.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground mb-1">Nenhum modelo disponível.</p>
                <p className="text-xs text-muted-foreground">Crie um modelo em Configurações → Contratos.</p>
              </div>
            ) : (
              <>
                <div>
                  <Label>Modelo</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome}{t.is_padrao && ' (padrão)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!sessionId && (
                  <div>
                    <Label>Vincular sessão (opcional)</Label>
                    <Select value={sessaoSelecionada} onValueChange={setSessaoSelecionada}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sem sessão vinculada" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessoes.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Sem sessões disponíveis</div>}
                        {sessoes.map((s) => (
                          <SelectItem key={s.id} value={s.session_id || s.id}>
                            {new Date(s.data_sessao).toLocaleDateString('pt-BR')} · {s.categoria}
                            {s.pacote ? ` — ${s.pacote}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Variáveis que serão preenchidas
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {VARIAVEIS_DISPONIVEIS.filter((v) => v.tipo === 'auto').slice(0, 10).map((v) => (
                      <div key={v.key} className="flex justify-between gap-2">
                        <span className="text-muted-foreground truncate">{v.label}:</span>
                        <span className="font-mono truncate text-right">{variaveis[v.key] || <em className="text-amber-600">vazio</em>}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
                    Variáveis sem dado no sistema (ex.: duração, valor do sinal) virarão <span className="px-1 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded">campos editáveis</span> destacados em amarelo no contrato — basta clicar e ajustar.
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div>
              <Label htmlFor="titulo">Título do contrato</Label>
              <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <Label>Conteúdo</Label>
              <div className="flex-1 overflow-y-auto">
                <ContratoRichEditor value={conteudo} onChange={setConteudo} minHeight="380px" />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {step === 'select' ? (
            <Button onClick={handleGerar} disabled={!templateId}>
              Gerar contrato
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep('select')}>Voltar</Button>
              <Button onClick={handleSalvar} disabled={saving || !titulo.trim() || !conteudo.trim()}>
                {saving ? 'Salvando...' : 'Salvar como rascunho'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
