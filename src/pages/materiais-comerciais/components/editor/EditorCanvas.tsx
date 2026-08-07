import React from 'react';
import { SectionDef } from './EditorSidebar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { UploadCloud, Image as ImageIcon } from 'lucide-react';

interface EditorCanvasProps {
  section: SectionDef;
}

export function EditorCanvas({ section }: EditorCanvasProps) {
  
  // Um formulário fictício dinâmico que muda com base no tipo da seção
  const renderForm = () => {
    switch (section.type) {
      case 'cover':
        return (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Título Principal da Capa</label>
              <Input defaultValue="Proposta Comercial - Casamento" className="text-lg font-medium" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subtítulo</label>
              <Input defaultValue="Fotografia documental para o dia mais importante da sua vida." />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Imagem de Fundo (Cover)</label>
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 bg-muted/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium mb-1">Clique para fazer upload</p>
                <p className="text-xs text-muted-foreground text-center">
                  Recomendado: 1920x1080px (Alta resolução)
                </p>
              </div>
            </div>
          </div>
        );
      
      case 'package':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome do Pacote</label>
                <Input defaultValue={section.title} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Valor (R$)</label>
                <Input defaultValue="3500,00" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Descrição Curta</label>
              <Textarea defaultValue="A cobertura essencial para a sua cerimônia e recepção." />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Itens Inclusos (Um por linha)</label>
              <Textarea 
                rows={5} 
                defaultValue={"Cobertura de 8 horas\n2 Fotógrafos\nPen-drive personalizado\nGaleria Online por 1 ano"} 
              />
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-6">
             <div>
              <label className="text-sm font-medium mb-1.5 block">Título da Seção</label>
              <Input defaultValue="Nossa Filosofia" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Texto de Apresentação</label>
              <Textarea 
                rows={6}
                defaultValue="Acreditamos que a fotografia não é sobre poses, mas sobre momentos..." 
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Foto do Fotógrafo/Equipe</label>
              <div className="flex flex-col items-center justify-center border border-border rounded-xl p-6 bg-muted/10 h-32">
                 <ImageIcon className="h-6 w-6 text-muted-foreground mb-2" />
                 <span className="text-sm text-muted-foreground">Upload de foto perfil (1:1)</span>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded-xl bg-muted/20 text-muted-foreground">
            <p className="text-sm">Campos de edição para a seção <strong>{section.title}</strong> serão injetados aqui.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex justify-center bg-muted/10 overflow-y-auto relative h-full">
      <div className="w-full max-w-3xl py-8 px-4 sm:px-8">
        
        {/* Placeholder Contextual */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{section.title}</h1>
            <p className="text-sm text-muted-foreground">Preencha o conteúdo desta seção.</p>
          </div>
          <Button variant="outline" size="sm" className="text-destructive border-border hover:bg-destructive/10 hover:text-destructive">
            Remover Seção
          </Button>
        </div>

        {/* Formulário Dinâmico */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8">
          {renderForm()}
        </div>

      </div>
    </div>
  );
}
