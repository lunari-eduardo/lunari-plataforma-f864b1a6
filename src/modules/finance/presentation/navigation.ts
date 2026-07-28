/**
 * Navegação interna do módulo Financeiro.
 * Comunicação desacoplada via CustomEvent — evita prop drilling entre abas irmãs.
 */

export type FluxoFocusPayload = {
  transacaoId: string;
  dataVencimento: string; // YYYY-MM-DD
  tipo: 'entrada' | 'saida';
};

export const FINANCE_SWITCH_TAB_EVENT = 'lunari:finance:switch-tab';
export const FINANCE_FOCUS_FLUXO_EVENT = 'lunari:finance:focus-fluxo';

export type FinanceTabName = 'visao-geral' | 'fluxo-financeiro' | 'gerenciar';

export function emitSwitchTab(tab: FinanceTabName) {
  window.dispatchEvent(new CustomEvent(FINANCE_SWITCH_TAB_EVENT, { detail: tab }));
}

export function emitFluxoFocus(payload: FluxoFocusPayload) {
  window.dispatchEvent(new CustomEvent(FINANCE_FOCUS_FLUXO_EVENT, { detail: payload }));
}

/** Troca para a aba Fluxo Financeiro e foca o lançamento indicado. */
export function openFluxoAndFocus(payload: FluxoFocusPayload) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'fluxo-financeiro');
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* noop */
  }
  emitSwitchTab('fluxo-financeiro');
  // Aguarda a aba montar antes de emitir o foco.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => emitFluxoFocus(payload));
  });
}
