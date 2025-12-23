import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';
import { 
  Bold, 
  Italic, 
  Underline, 
  Eye, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered,
  Quote
} from 'lucide-react';

interface BlogRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

/**
 * Editor Rich Text especializado para artigos de blog
 * Suporta: H1, H2, H3, Bold, Italic, Underline, Listas (ul/ol), Blockquote
 * Gera HTML semântico para SEO
 */
export function BlogRichTextEditor({
  value,
  onChange,
  placeholder = 'Escreva o conteúdo do artigo...',
  className,
  minHeight = '400px',
}: BlogRichTextEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Tags permitidas para o blog (HTML semântico completo)
  const ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 'b', 'i', 'div', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote',
    'a', 'img'
  ];

  const ALLOWED_ATTR = ['href', 'src', 'alt', 'class', 'target', 'rel'];

  // Inicializar conteúdo
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = DOMPurify.sanitize(value, { ALLOWED_TAGS, ALLOWED_ATTR });
    }
  }, []);

  // Atualizar quando valor externo mudar
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      const sanitized = DOMPurify.sanitize(value, { ALLOWED_TAGS, ALLOWED_ATTR });
      if (sanitized !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = sanitized;
      }
    }
  }, [value]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const formatBlock = (tag: string) => {
    document.execCommand('formatBlock', false, tag);
    editorRef.current?.focus();
    handleInput();
  };

  const handleInput = () => {
    if (editorRef.current) {
      const sanitized = DOMPurify.sanitize(editorRef.current.innerHTML, { 
        ALLOWED_TAGS, 
        ALLOWED_ATTR 
      });
      onChange(sanitized);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Atalhos de teclado
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          break;
        case '1':
          e.preventDefault();
          formatBlock('h1');
          break;
        case '2':
          e.preventDefault();
          formatBlock('h2');
          break;
        case '3':
          e.preventDefault();
          formatBlock('h3');
          break;
      }
    }
  };

  return (
    <div className={cn('border rounded-lg overflow-hidden bg-background', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
        {/* Headings */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-border">
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => formatBlock('h1')}
            aria-label="Título H1"
            title="Título principal (Ctrl+1)"
          >
            <Heading1 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => formatBlock('h2')}
            aria-label="Título H2"
            title="Subtítulo (Ctrl+2)"
          >
            <Heading2 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => formatBlock('h3')}
            aria-label="Título H3"
            title="Sub-subtítulo (Ctrl+3)"
          >
            <Heading3 className="h-4 w-4" />
          </Toggle>
        </div>

        {/* Text formatting */}
        <div className="flex items-center gap-0.5 px-2 border-r border-border">
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('bold')}
            aria-label="Negrito"
            title="Negrito (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('italic')}
            aria-label="Itálico"
            title="Itálico (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('underline')}
            aria-label="Sublinhado"
            title="Sublinhado (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </Toggle>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-0.5 px-2 border-r border-border">
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('insertUnorderedList')}
            aria-label="Lista com marcadores"
            title="Lista com marcadores"
          >
            <List className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('insertOrderedList')}
            aria-label="Lista numerada"
            title="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </Toggle>
        </div>

        {/* Blockquote */}
        <div className="flex items-center gap-0.5 px-2 border-r border-border">
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => formatBlock('blockquote')}
            aria-label="Citação"
            title="Citação"
          >
            <Quote className="h-4 w-4" />
          </Toggle>
        </div>

        {/* Parágrafo normal */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => formatBlock('p')}
          className="text-xs h-8"
          title="Parágrafo normal"
        >
          Normal
        </Button>

        {/* Preview toggle */}
        <div className="ml-auto">
          <Toggle
            size="sm"
            pressed={isPreview}
            onPressedChange={setIsPreview}
            aria-label="Preview"
            title="Visualizar"
          >
            <Eye className="h-4 w-4" />
          </Toggle>
        </div>
      </div>

      {/* Editor / Preview */}
      {isPreview ? (
        <div
          className="prose prose-lg dark:prose-invert max-w-none p-4
            prose-headings:text-foreground prose-headings:font-bold
            prose-h1:text-3xl prose-h1:mt-6 prose-h1:mb-4
            prose-h2:text-2xl prose-h2:mt-5 prose-h2:mb-3
            prose-h3:text-xl prose-h3:mt-4 prose-h3:mb-2
            prose-p:text-foreground/90 prose-p:leading-relaxed prose-p:my-3
            prose-strong:text-foreground prose-strong:font-semibold
            prose-ul:text-foreground/90 prose-ul:my-3 prose-ul:pl-6
            prose-ol:text-foreground/90 prose-ol:my-3 prose-ol:pl-6
            prose-li:my-1
            prose-blockquote:border-l-4 prose-blockquote:border-primary 
            prose-blockquote:bg-muted/50 prose-blockquote:rounded-r-lg 
            prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:my-4
            prose-blockquote:italic prose-blockquote:text-muted-foreground"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(value, { ALLOWED_TAGS, ALLOWED_ATTR }) 
          }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className={cn(
            'p-4 focus:outline-none',
            'prose prose-lg dark:prose-invert max-w-none',
            'prose-headings:text-foreground prose-headings:font-bold',
            'prose-h1:text-3xl prose-h1:mt-4 prose-h1:mb-3',
            'prose-h2:text-2xl prose-h2:mt-3 prose-h2:mb-2',
            'prose-h3:text-xl prose-h3:mt-2 prose-h3:mb-1',
            'prose-p:text-foreground/90 prose-p:leading-relaxed',
            'prose-strong:text-foreground',
            'prose-ul:text-foreground/90 prose-ul:pl-6',
            'prose-ol:text-foreground/90 prose-ol:pl-6',
            'prose-blockquote:border-l-4 prose-blockquote:border-primary',
            'prose-blockquote:bg-muted/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-3',
            '[&:empty]:before:content-[attr(data-placeholder)]',
            '[&:empty]:before:text-muted-foreground',
            '[&:empty]:before:pointer-events-none'
          )}
          style={{ minHeight }}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      )}
    </div>
  );
}

export default BlogRichTextEditor;
