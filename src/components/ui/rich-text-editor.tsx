import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Link,
  Eye,
  Edit,
  Type
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Digite sua descrição...",
  className,
  minHeight = "120px"
}: RichTextEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Keyboard shortcuts
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
      }
    }
  }, [execCommand]);

  const convertToMarkdown = (html: string): string => {
    return html
      .replace(/<b>|<strong>/g, '**')
      .replace(/<\/b>|<\/strong>/g, '**')
      .replace(/<i>|<em>/g, '_')
      .replace(/<\/i>|<\/em>/g, '_')
      .replace(/<u>/g, '<u>')
      .replace(/<\/u>/g, '</u>')
      .replace(/<br>/g, '\n')
      .replace(/<div>/g, '\n')
      .replace(/<\/div>/g, '')
      .replace(/<[^>]*>/g, '');
  };

  const formatPreview = (html: string): string => {
    if (!html || html.trim() === '') return placeholder;
    return html
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>');
  };

  return (
    <div className={cn("border border-lunar-border rounded-lg overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-lunar-border bg-lunar-background/50">
        <Toggle
          pressed={false}
          onPressedChange={() => execCommand('bold')}
          size="sm"
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        
        <Toggle
          pressed={false}
          onPressedChange={() => execCommand('italic')}
          size="sm"
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        
        <Toggle
          pressed={false}
          onPressedChange={() => execCommand('underline')}
          size="sm"
          aria-label="Underline"
        >
          <Underline className="h-4 w-4" />
        </Toggle>
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        <Toggle
          pressed={false}
          onPressedChange={() => execCommand('insertUnorderedList')}
          size="sm"
          aria-label="Bullet List"
        >
          <List className="h-4 w-4" />
        </Toggle>
        
        <Toggle
          pressed={false}
          onPressedChange={() => execCommand('insertOrderedList')}
          size="sm"
          aria-label="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = prompt('Digite a URL:');
            if (url) execCommand('createLink', url);
          }}
        >
          <Link className="h-4 w-4" />
        </Button>
        
        <div className="ml-auto flex items-center gap-1">
          <Toggle
            pressed={isPreview}
            onPressedChange={setIsPreview}
            size="sm"
            aria-label="Toggle Preview"
          >
            {isPreview ? <Edit className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Toggle>
        </div>
      </div>

      {/* Editor/Preview Area */}
      <div className="relative">
        {isPreview ? (
          <div 
            className="p-3 bg-lunar-background text-lunar-text prose prose-sm max-w-none"
            style={{ minHeight }}
            dangerouslySetInnerHTML={{ 
              __html: formatPreview(value) || `<span class="text-lunar-textSecondary">${placeholder}</span>`
            }}
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            className="p-3 bg-lunar-background text-lunar-text outline-none prose prose-sm max-w-none"
            style={{ minHeight }}
            dangerouslySetInnerHTML={{ __html: value }}
            data-placeholder={placeholder}
          />
        )}
      </div>
      
      {/* Helper text */}
      <div className="px-3 py-1 text-xs text-lunar-textSecondary bg-lunar-background/30 border-t border-lunar-border">
        <Type className="inline h-3 w-3 mr-1" />
        Use Ctrl+B para <strong>negrito</strong>, Ctrl+I para <em>itálico</em>, Ctrl+U para <u>sublinhado</u>
      </div>
    </div>
  );
}