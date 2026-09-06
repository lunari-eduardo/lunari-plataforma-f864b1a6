import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  RotateCcw,
  Images,
  Calendar,
  DollarSign,
  Package,
  QrCode,
  Link2,
  Camera,
  Layers,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { SessionPaymentExtended } from '@/types/sessionPayments';

// Badges neutros (Silent Luxury): superfície discreta + tipografia semântica.
export const BADGE_BASE = 'border-border/20 bg-muted/40 font-medium';
export const BADGE_OK = `${BADGE_BASE} text-emerald-600 dark:text-emerald-500`;
export const BADGE_WARN = `${BADGE_BASE} text-accent-gold`;
export const BADGE_DANGER = `${BADGE_BASE} text-destructive`;
export const BADGE_NEUTRAL = `${BADGE_BASE} text-muted-foreground`;

export const getStatusBadge = (payment: SessionPaymentExtended) => {
  if (payment.statusRecebimento) {
    switch (payment.statusRecebimento) {
      case 'confirmado':
        return <Badge className={BADGE_WARN}>Confirmado</Badge>;
      case 'recebido':
        return <Badge className={BADGE_OK}>Recebido</Badge>;
      case 'antecipado':
        return <Badge className={BADGE_NEUTRAL}>Antecipado</Badge>;
      case 'pendente':
        return <Badge className={BADGE_NEUTRAL}>Pendente</Badge>;
    }
  }

  const { statusPagamento } = payment;
  if (statusPagamento === 'estornado') {
    return <Badge className={BADGE_DANGER}>Estornado</Badge>;
  }
  if (statusPagamento === 'pago') {
    return <Badge className={BADGE_OK}>Pago</Badge>;
  }
  if (statusPagamento === 'pendente') {
    const isOverdue = payment.dataVencimento && new Date(payment.dataVencimento) < new Date();
    if (isOverdue) {
      return <Badge className={BADGE_DANGER}>Atrasado</Badge>;
    }
    return <Badge className={BADGE_WARN}>Pendente</Badge>;
  }
  return <Badge variant="outline">{statusPagamento}</Badge>;
};

// Helper para obter a finalidade/motivo funcional do pagamento (Sinal, Sessão, Extras, etc.)
export const getPaymentOriginInfo = (payment: SessionPaymentExtended) => {
  const finalidade = payment.finalidade;
  const obs = payment.observacoes || '';
  const isEstorno = payment.tipo === 'estorno' || payment.statusPagamento === 'estornado' || finalidade === 'estorno';
  const isCredito = payment.origem === 'credito' || finalidade === 'credito' || obs.toLowerCase().includes('crédito do cliente');

  if (isEstorno) {
    return {
      label: 'Estorno',
      badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
      icon: <RotateCcw className="h-3 w-3 text-destructive" />
    };
  }
  if (isCredito) {
    return {
      label: 'Crédito',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
      icon: <CreditCard className="h-3 w-3 text-emerald-600" />
    };
  }
  if (finalidade === 'fotos_extras' || /(foto[s]?\s+extra|\[extras)/i.test(obs)) {
    return {
      label: 'Extras',
      badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
      icon: <Images className="h-3 w-3 text-purple-600 dark:text-purple-400" />
    };
  }
  if (finalidade === 'sessao_e_extras' || /(sess[ãoa]o\s*\+\s*extras|sessao_e_extras)/i.test(obs)) {
    return {
      label: 'Sessão + Extras',
      badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
      icon: <Layers className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
    };
  }
  if (
    finalidade === 'sinal' ||
    obs.toLowerCase().includes('entrada') ||
    obs.toLowerCase().includes('sinal') ||
    obs.toLowerCase().includes('reserva') ||
    obs.toLowerCase().includes('arras')
  ) {
    return {
      label: 'Sinal',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      icon: <Calendar className="h-3 w-3 text-amber-600 dark:text-amber-400" />
    };
  }
  if (finalidade === 'avulso' || /(venda\s+avulsa|avulso)/i.test(obs)) {
    return {
      label: 'Venda Avulsa',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      icon: <ShoppingBag className="h-3 w-3 text-amber-600 dark:text-amber-400" />
    };
  }
  return {
    label: 'Sessão',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    icon: <Camera className="h-3 w-3 text-blue-600 dark:text-blue-400" />
  };
};

// Helper para obter o provedor/meio de pagamento
export const getProviderInfo = (payment: SessionPaymentExtended) => {
  const { origem, observacoes, forma_pagamento } = payment;
  const obs = observacoes || '';
  const forma = forma_pagamento || '';

  if (origem === 'credito' || obs.toLowerCase().includes('crédito do cliente')) {
    return { label: 'Crédito do cliente', icon: <CreditCard className="h-3 w-3 text-emerald-600" /> };
  }
  if (origem === 'infinitepay' || obs.toLowerCase().includes('infinitepay')) {
    return { label: 'InfinitePay', icon: <Link2 className="h-3 w-3 text-green-600" /> };
  }
  if (origem === 'asaas' || obs.toLowerCase().includes('asaas')) {
    if (obs.toLowerCase().includes('pix')) {
      return { label: 'Pix Asaas', icon: <QrCode className="h-3 w-3 text-blue-600" /> };
    }
    return { label: 'Link Asaas', icon: <CreditCard className="h-3 w-3 text-blue-600" /> };
  }
  if (origem === 'mercadopago' || obs.toLowerCase().includes('mercado pago') || obs.toLowerCase().includes('mp #')) {
    if (obs.toLowerCase().includes('pix')) {
      return { label: 'Pix MP', icon: <QrCode className="h-3 w-3 text-primary" /> };
    }
    return { label: 'Link MP', icon: <Link2 className="h-3 w-3 text-primary" /> };
  }

  if (forma) {
    return { label: forma, icon: <Wallet className="h-3 w-3 text-muted-foreground" /> };
  }
  switch (origem) {
    case 'agenda':
      return { label: 'Agenda', icon: <Calendar className="h-3 w-3 text-muted-foreground" /> };
    case 'workflow_rapido':
      return { label: 'Studio', icon: <Camera className="h-3 w-3 text-muted-foreground" /> };
    case 'parcelado':
      return { label: 'Parcelado', icon: <Package className="h-3 w-3 text-muted-foreground" /> };
    default:
      return { label: 'Manual', icon: <DollarSign className="h-3 w-3 text-muted-foreground" /> };
  }
};
