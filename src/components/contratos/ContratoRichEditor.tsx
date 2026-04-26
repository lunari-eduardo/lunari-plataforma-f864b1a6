import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Underline as UIcon, List, ListOrdered, Heading1, Heading2, Quote, Undo, Redo } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContratoRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  minHeight?: string;
  className?: string;
}

export function ContratoRichEditor({
  value,
  onChange,
  placeholder = 'Comece a redigir seu contrato...',
  editable = true,
  minHeight = '320px',
  className,
}: ContratoRichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none px-4 py-3',
          'prose-headings:font-semibold prose-p:my-2'
        ),
        style: `min-height: ${minHeight};`,
      },
    },
  });

  // Sincroniza valor externo quando muda (ex.: troca de template)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return null;

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden bg-background', className)}>
      {editable && (
        <div className="flex items-center flex-wrap gap-1 p-2 border-b border-border bg-muted/30">
          <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()} aria-label="Negrito">
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()} aria-label="Itálico">
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive('underline')} onPressedChange={() => editor.chain().focus().toggleUnderline().run()} aria-label="Sublinhado">
            <UIcon className="h-4 w-4" />
          </Toggle>
          <div className="w-px h-5 bg-border mx-1" />
          <Toggle size="sm" pressed={editor.isActive('heading', { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} aria-label="Título 1">
            <Heading1 className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive('heading', { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Título 2">
            <Heading2 className="h-4 w-4" />
          </Toggle>
          <div className="w-px h-5 bg-border mx-1" />
          <Toggle size="sm" pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} aria-label="Lista">
            <List className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive('orderedList')} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Lista numerada">
            <ListOrdered className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive('blockquote')} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Citação">
            <Quote className="h-4 w-4" />
          </Toggle>
          <div className="ml-auto flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
              <Undo className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
              <Redo className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

/** Helper para inserir texto na posição atual do editor (exposto via ref futura). */
export function insertVariableIntoEditor(editor: any, variable: string) {
  if (!editor) return;
  editor.chain().focus().insertContent(`{{${variable}}}`).run();
}
