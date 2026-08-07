import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EditorSidebar, MOCK_SECTIONS, SectionDef } from './components/editor/EditorSidebar';
import { EditorCanvas } from './components/editor/EditorCanvas';

export default function EditorMaterialPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Estado
  const [materialName, setMaterialName] = useState('Proposta de Casamento Premium');
  const [sections, setSections] = useState<SectionDef[]>(MOCK_SECTIONS);
  const [activeSectionId, setActiveSectionId] = useState<string>(MOCK_SECTIONS[0].id);
  const [isSaving, setIsSaving] = useState(false);

  // Derivando a seção ativa
  const activeSection = sections.find(s => s.id === activeSectionId) || sections[0];

  const handlePublish = () => {
    setIsSaving(true);
    // Simular API request
    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden absolute inset-0 z-50">
      
      {/* 1. Topbar Imersiva */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        
        {/* Esquerda: Voltar e Nome */}
        <div className="flex items-center gap-4 flex-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-foreground gap-1.5 -ml-2"
            onClick={() => navigate('/app/materiais')}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Biblioteca</span>
          </Button>
          
          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />
          
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <LayoutTemplate className="h-4 w-4 text-primary shrink-0" />
            <Input 
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              className="h-8 border-transparent bg-transparent hover:bg-muted/50 focus:bg-background px-2 text-sm font-medium shadow-none focus-visible:ring-1"
              placeholder="Nome do Material"
            />
          </div>
        </div>

        {/* Direita: Status e Ações */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500/80" />
            Salvo
          </div>
          
          <Button variant="outline" size="sm" className="gap-2 hidden md:flex">
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          
          <Button size="sm" className="gap-2" onClick={handlePublish} disabled={isSaving}>
            {isSaving ? "Publicando..." : "Publicar Versão"}
          </Button>
        </div>
      </header>

      {/* 2. Área Principal de Edição */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar Esquerda (Navegação de Seções) */}
        <EditorSidebar 
          sections={sections}
          activeSectionId={activeSectionId}
          onSelectSection={setActiveSectionId}
        />

        {/* Canvas Central (Formulário Dinâmico) */}
        <EditorCanvas 
          section={activeSection}
        />

      </div>
    </div>
  );
}
