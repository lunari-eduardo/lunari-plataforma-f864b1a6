import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface EditableTextProps {
  value: string | undefined;
  onCommit: (value: string) => void;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  multiline?: boolean;
  editable?: boolean;
}

// ============================================================
// EDIÇÃO INLINE NA ARTE
// Duplo clique no texto ativa contentEditable; commit no blur,
// Enter (Ctrl+Enter se multiline) ou toolbar; Esc cancela.
//
// Regras de robustez:
// - O foco/seleção acontece num useEffect disparado APÓS o
//   React aplicar contentEditable no DOM (nada de rAF adiantado).
// - O texto NUNCA é children do React enquanto editável: o DOM é
//   gerenciado imperativamente e sincronizado apenas fora da
//   edição — nenhum re-render pode resetar o que foi digitado.
// - Campos vazios ficam visíveis e clicáveis via CSS :empty
//   (regra .pa-editable-text em index.css) + placeholder.
// - O caret é posicionado no ponto do duplo clique.
// ============================================================

export function EditableText({
  value,
  onCommit,
  as: Tag = 'span',
  className,
  style,
  placeholder,
  multiline = false,
  editable = false,
}: EditableTextProps) {
  const ref = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);
  const cancelledRef = useRef(false);
  const clickPointRef = useRef<{ x: number; y: number } | null>(null);
  const text = value ?? '';

  // Sincroniza o DOM apenas fora da edição (nunca pula o caret).
  // useLayoutEffect: texto presente já na primeira pintura (sem flash).
  useLayoutEffect(() => {
    if (editing) return;
    const el = ref.current;
    if (el && el.textContent !== text) el.textContent = text;
  }, [text, editing]);

  // Foca e posiciona o caret DEPOIS de contentEditable estar no DOM
  useEffect(() => {
    if (!editing) return;
    cancelledRef.current = false;
    const el = ref.current;
    if (!el) return;
    el.focus();

    let range: Range | null = null;
    const pt = clickPointRef.current;
    if (pt && typeof (document as any).caretRangeFromPoint === 'function') {
      const pos = (document as any).caretRangeFromPoint(pt.x, pt.y);
      if (pos && el.contains(pos.startContainer)) range = pos;
    }
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false); // caret no fim
    }
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing]);

  if (!editable) {
    return React.createElement(Tag, { className, style }, text || null);
  }

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditing(false);
      return;
    }
    const el = ref.current;
    const next = el
      ? (multiline ? (el.innerText ?? '') : (el.textContent ?? '').replace(/\n/g, ' '))
      : text;
    setEditing(false);
    if (next !== text) onCommit(next.trim() === '' && !multiline ? '' : next);
  };

  const cancel = () => {
    cancelledRef.current = true;
    setEditing(false);
    if (ref.current) ref.current.textContent = text;
  };

  return React.createElement(Tag, {
    ref,
    className: cn(
      'pa-editable-text',
      className,
      editing
        ? 'outline-none ring-2 ring-primary/70 ring-offset-2 cursor-text relative z-30'
        : 'cursor-text hover:ring-1 hover:ring-primary/30 hover:ring-offset-1'
    ),
    style,
    contentEditable: editing,
    suppressContentEditableWarning: true,
    'data-placeholder': placeholder ?? 'Clique duas vezes para editar',
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      clickPointRef.current = { x: e.clientX, y: e.clientY };
      setEditing(true);
    },
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Enter' && (!multiline || (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
    },
    onPaste: (e: React.ClipboardEvent) => {
      // Cola sempre como texto puro
      e.preventDefault();
      const raw = e.clipboardData.getData('text/plain');
      const t = multiline ? raw : raw.replace(/\s+/g, ' ');
      document.execCommand('insertText', false, t);
    },
    onMouseDown: (e: React.MouseEvent) => {
      // Durante a edição, isola o mouse do wrapper do bloco
      if (editing) e.stopPropagation();
    },
    onClick: (e: React.MouseEvent) => {
      if (editing) e.stopPropagation();
    },
  });
}
