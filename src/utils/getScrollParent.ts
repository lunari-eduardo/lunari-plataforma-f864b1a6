/**
 * Encontra o ancestral rolável de um elemento.
 * Retorna `window` quando nenhum ancestral com overflow auto/scroll é encontrado.
 */
export function getScrollParent(el: HTMLElement | null): HTMLElement | Window {
  if (!el) return window;
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const isScrollable =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight;
    if (isScrollable) return node;
    node = node.parentElement;
  }
  return window;
}

export function getScrollTop(target: HTMLElement | Window): number {
  return target instanceof Window
    ? window.scrollY
    : target.scrollTop;
}

export function setScrollTop(target: HTMLElement | Window, value: number): void {
  if (target instanceof Window) {
    window.scrollTo({ top: value });
  } else {
    target.scrollTop = value;
  }
}
