import React, { useEffect, useRef, useState } from 'react';
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
// No modo de edição: duplo clique no texto ativa contentEditable;
// commit no blur/Enter (multiline: Ctrl+Enter ou blur), Esc cancela.
// Sem re-render durante a digitação (textContent só é sincronizado
// quando NÃO está em edição) — mantém o caret estável.
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

  const text = value ?? '';

  // Sincroniza o DOM apenas fora da edição (evita pular o caret)
  useEffect(() => {
    if (!editing && ref.current && ref.current.textContent !== text) {
      ref.current.textContent = text;
    }
  }, [text, editing]);

  if (!editable) {
    return React.createElement(Tag, { ref, className, style }, text || null);
  }

  const enterEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    // Foca após o contentEditable ser ativado
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  };

  const commit = () => {
    setEditing(false);
    const el = ref.current;
    if (!el) return;
    const next = multiline ? (el.innerText ?? '') : (el.textContent ?? '').replace(/\n/g, ' ');
    if (next !== text) onCommit(next);
    else el.textContent = text; // normaliza de volta
  };

  const cancel = () => {
    setEditing(false);
    if (ref.current) ref.current.textContent = text;
  };

  return React.createElement(Tag, {
    ref,
    className: cn(
      className,
      editing
        ? 'outline-none ring-2 ring-primary/70 ring-offset-2 cursor-text relative z-30'
        : 'cursor-text hover:ring-1 hover:ring-primary/30 hover:ring-offset-1'
    ),
    style,
    contentEditable: editing,
    suppressContentEditableWarning: true,
    'data-placeholder': placeholder,
    onDoubleClick: enterEditing,
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
    onClick: (e: React.MouseEvent) => {
      // Durante a edição, não propague (não troca o bloco selecionado)
      if (editing) e.stopPropagation();
    },
  }, text || null);
}
