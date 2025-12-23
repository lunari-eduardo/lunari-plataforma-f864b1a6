import React, { useState, useRef, useCallback, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Toggle } from '@/components/ui/toggle';
import { 
  Bold, 
  Italic, 
  Underline, 
  Eye,
  Edit
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
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize editor content properly
  useEffect(() => {
    if (editorRef.current && !isInitialized) {
      if (value && value.trim() !== '') {
        editorRef.current.innerHTML = value;
      } else {
        editorRef.current.innerHTML = '';
      }
      setIsInitialized(true);
    }
  }, [value, isInitialized]);

  // Update content when value changes externally
  useEffect(() => {
    if (editorRef.current && isInitialized && !isPreview) {
      const currentContent = editorRef.current.innerHTML;
      if (currentContent !== value) {
        const selection = window.getSelection();
        const range = selection?.getRangeAt(0);
        const cursorPosition = range?.startOffset;
        
        editorRef.current.innerHTML = value || '';
        
        // Restore cursor position
        if (selection && range && cursorPosition !== undefined) {
          try {
            const newRange = document.createRange();
            const textNode = editorRef.current.childNodes[0] || editorRef.current;
            newRange.setStart(textNode, Math.min(cursorPosition, textNode.textContent?.length || 0));
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } catch (e) {
            // Fallback: place cursor at end
            const newRange = document.createRange();
            newRange.selectNodeContents(editorRef.current);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
      }
    }
  }, [value, isInitialized, isPreview]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const sanitized = DOMPurify.sanitize(editorRef.current.innerHTML, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'b', 'i', 'div'],
        ALLOWED_ATTR: []
      });
      onChange(sanitized);
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
              __html: DOMPurify.sanitize(
                formatPreview(value) || `<span class="text-lunar-textSecondary">${placeholder}</span>`,
                { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'b', 'i', 'span'], ALLOWED_ATTR: ['class'] }
              )
            }}
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            className="p-3 bg-lunar-background text-lunar-text outline-none prose prose-sm max-w-none focus:ring-2 focus:ring-lunar-accent/20 focus:outline-none"
            style={{ minHeight }}
            data-placeholder={placeholder}
          />
        )}
      </div>
    </div>
  );
}
