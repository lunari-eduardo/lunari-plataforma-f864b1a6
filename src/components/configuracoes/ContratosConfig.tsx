import { useState } from 'react';
import { useContratoTemplates } from '@/hooks/useContratoTemplates';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Star, FileText } from 'lucide-react';
import { ContratoTemplateEditorModal } from '@/components/contratos/ContratoTemplateEditorModal';
import { Badge } from '@/components/ui/badge';
import type { ContratoTemplate } from '@/types/contrato';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const SEED_CONTENT = `<h2>Contrato de Prestação de Serviços Fotográficos</h2>
<p>Por meio deste instrumento particular, de um lado <strong>{{fotografo_nome}}</strong> ("CONTRATADO"), e de outro <strong>{{cliente_nome}}</strong> ("CONTRATANTE"), telefone {{cliente_telefone}}, têm entre si, justo e contratado o seguinte:</p>
<h3>1. Do objeto</h3>
<p>O CONTRATADO se compromete a realizar serviços fotográficos referentes à categoria <strong>{{sessao_categoria}}</strong> ({{sessao_pacote}}), no dia <strong>{{sessao_data}}</strong> às <strong>{{sessao_hora}}</strong>.</p>
<h3>2. Do valor</h3>
<p>O valor total dos serviços é de <strong>{{sessao_valor_total}}</strong>, conforme condições acordadas previamente entre as partes.</p>
<h3>3. Da entrega</h3>
<p>O material será entregue por meio de galeria digital, conforme prazos estabelecidos no pacote contratado.</p>
<h3>4. Disposições finais</h3>
<p>As partes elegem o foro de {{cidade_atual}} para dirimir quaisquer dúvidas oriundas deste contrato.</p>
<p style="margin-top:48px;">{{cidade_atual}}, {{data_atual}}.</p>
<p style="margin-top:48px;">______________________________<br/>{{fotografo_nome}}</p>
<p style="margin-top:32px;">______________________________<br/>{{cliente_nome}}</p>`;

export default function ContratosConfig() {
  const { templates, isLoading, create, update, remove } = useContratoTemplates();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContratoTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContratoTemplate | null>(null);

  const handleNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleSeed = async () => {
    await create({
      nome: 'Contrato padrão de prestação de serviços',
      descricao: 'Modelo genérico inicial — ajuste à sua realidade.',
      categoria: 'geral',
      conteudo: SEED_CONTENT,
      is_padrao: true,
    });
  };

  const handleSave = async (data: any) => {
    if (editing) {
      await update({ id: editing.id, ...data });
    } else {
      await create(data);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Modelos de contrato</h3>
          <p className="text-sm text-muted-foreground">Crie modelos reutilizáveis com variáveis dinâmicas.</p>
        </div>
        <Button onClick={handleNew} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Novo modelo
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <h4 className="font-medium mb-1">Nenhum modelo ainda</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Comece com um modelo genérico que você pode editar a qualquer momento.
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={handleSeed}>Usar modelo padrão</Button>
            <Button onClick={handleNew}>Criar do zero</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium truncate">{t.nome}</h4>
                  {t.is_padrao && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="h-3 w-3" />
                      Padrão
                    </Badge>
                  )}
                  {t.categoria && t.categoria !== 'geral' && (
                    <Badge variant="outline">{t.categoria}</Badge>
                  )}
                </div>
                {t.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{t.descricao}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setEditorOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(t)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ContratoTemplateEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        template={editing}
        onSave={handleSave}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.nome}" será excluído. Contratos já gerados a partir deste modelo permanecerão intactos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmDelete) await remove(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
