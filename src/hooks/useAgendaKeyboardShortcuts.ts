import { useEffect } from 'react';
import type { ViewType } from '@/utils/dateFormatters';

interface ShortcutHandlers {
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: ViewType) => void;
  enabled?: boolean;
}

export function useAgendaKeyboardShortcuts({
  onPrev,
  onNext,
  onToday,
  onViewChange,
  enabled = true,
}: ShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable;
      if (isEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'ArrowLeft':
          onPrev();
          break;
        case 'ArrowRight':
          onNext();
          break;
        case 't':
        case 'T':
          onToday();
          break;
        case 'd':
        case 'D':
          onViewChange('day');
          break;
        case 'w':
        case 'W':
          onViewChange('week');
          break;
        case 'm':
        case 'M':
          onViewChange('month');
          break;
        case 'y':
        case 'Y':
          onViewChange('year');
          break;
        default:
          return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onPrev, onNext, onToday, onViewChange]);
}
