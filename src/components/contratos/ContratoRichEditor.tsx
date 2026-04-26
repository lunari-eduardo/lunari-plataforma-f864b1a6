import React, { useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import {
  Bold, Italic, Underline as UIcon,
  List, ListOrdered, Heading1, Heading2,
  Quote, Undo, Redo,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContratoRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  minHeight?: string;
  className?: string;
}

const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u',
  'ul', 'ol', 'li',
  'blockquote',
  'a',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'style'];

function sanitize(html: string): string {
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['style'],
  });
}

/**
 * Editor de contratos baseado em contentEditable nativo.
 * Estável, sem dependências externas frágeis. Renderiza HTML diretamente
 * e mantém o cursor durante a digitação.
 */
export function ContratoRichEditor({
  value,
  onChange,
  placeholder = 'Comece a redigir seu contrato...',
  editable = true,
  minHeight = '320px',
  className,
}: ContratoRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string>('');

  // Carrega/atualiza o conteúdo externamente apenas quando muda de fato
  // (evita destruir o cursor do usuário enquanto digita).
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const incoming = sanitize(value || '');
    // Se o último HTML emitido pelo próprio editor é igual ao incoming,
    // não precisa redefinir innerHTML (evita reset de cursor).
    if (incoming === lastEmittedRef.current) return;
    if (el.innerHTML !== incoming) {
      el.innerHTML = incoming;
      lastEmittedRef.current = incoming;
    }
  }, [value]);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const sanitized = sanitize(el.innerHTML);
    lastEmittedRef.current = sanitized;
    onChange(sanitized);
  }, [onChange]);

  const exec = useCallback((command: string, arg?: string) => {
    if (!editable) return;
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  }, [editable, emitChange]);

  const formatBlock = useCallback((tag: string) => {
    if (!editable) return;
    editorRef.current?.focus();
    // execCommand espera o tag entre <> em alguns navegadores
    document.execCommand('formatBlock', false, `<${tag}>`);
    emitChange();
  }, [editable, emitChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    switch (e.key.toLowerCase()) {
      case 'b': e.preventDefault(); exec('bold'); break;
      case 'i': e.preventDefault(); exec('italic'); break;
      case 'u': e.preventDefault(); exec('underline'); break;
      case 'z': e.preventDefault(); exec(e.shiftKey ? 'redo' : 'undo'); break;
      case 'y': e.preventDefault(); exec('redo'); break;
    }
  }, [exec]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Cola como texto plano para evitar HTML quebrado de fontes externas
    if (!editable) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    emitChange();
  }, [editable, emitChange]);

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden bg-background flex flex-col', className)}>
      {editable && (
        <div className="flex items-center flex-wrap gap-1 p-2 border-b border-border bg-muted/30">
          <Toggle size="sm" pressed={false} onPressedChange={() => exec('bold')} aria-label="Negrito">
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={false} onPressedChange={() => exec('italic')} aria-label="Itálico">
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={false} onPressedChange={() => exec('underline')} aria-label="Sublinhado">
            <UIcon className="h-4 w-4" />
          </Toggle>

          <div className="w-px h-5 bg-border mx-1" />

          <Toggle size="sm" pressed={false} onPressedChange={() => formatBlock('h2')} aria-label="Título 1">
            <Heading1 className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={false} onPressedChange={() => formatBlock('h3')} aria-label="Título 2">
            <Heading2 className="h-4 w-4" />
          </Toggle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => formatBlock('p')}
            title="Parágrafo normal"
          >
            P
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Toggle size="sm" pressed={false} onPressedChange={() => exec('insertUnorderedList')} aria-label="Lista">
            <List className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={false} onPressedChange={() => exec('insertOrderedList')} aria-label="Lista numerada">
            <ListOrdered className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={false} onPressedChange={() => formatBlock('blockquote')} aria-label="Citação">
            <Quote className="h-4 w-4" />
          </Toggle>

          <div className="ml-auto flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => exec('undo')} aria-label="Desfazer">
              <Undo className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => exec('redo')} aria-label="Refazer">
              <Redo className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={editable}
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        spellCheck
        className={cn(
          'contrato-editor px-4 py-3 outline-none overflow-y-auto bg-background text-foreground text-sm leading-relaxed',
          // Tipografia para que o usuário enxergue os modelos
          '[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-foreground',
          '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-foreground',
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-foreground',
          '[&_p]:my-2 [&_p]:text-foreground',
          '[&_strong]:font-semibold [&_strong]:text-foreground',
          '[&_em]:italic',
          '[&_u]:underline',
          '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2',
          '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2',
          '[&_li]:my-1',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-3',
          '[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:pointer-events-none'
        )}
        style={{ minHeight }}
      />
    </div>
  );
}

/** Helper mantido para compatibilidade da API anterior. */
export function insertVariableIntoEditor(_editor: any, _variable: string) {
  // No-op: agora a inserção de variáveis é feita pelo modal que controla `value`.
}
