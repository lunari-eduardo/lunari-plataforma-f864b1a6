/**
 * ConfiguracoesView — wrapper legacy da aba "Configurações", agora renderiza
 * o novo Hub "Gerenciar" do módulo Financeiro. Mantido apenas para preservar
 * o roteamento de imports existente.
 */
import { memo } from 'react';
import GerenciarView from '@/components/financas/gerenciar/GerenciarView';

export const ConfiguracoesView = memo(function ConfiguracoesView() {
  return <GerenciarView />;
});

export default ConfiguracoesView;
