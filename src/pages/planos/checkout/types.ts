import { Camera, Check, Image, Users, Palette, ShieldCheck } from 'lucide-react';
import React from 'react';

export interface BenefitItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export const BENEFITS_AVULSO: BenefitItem[] = [
  { icon: Image, label: 'Galerias ilimitadas' },
  { icon: Users, label: 'Clientes ilimitados' },
  { icon: Camera, label: 'Até 2560px de resolução' },
  { icon: Palette, label: 'Presets de galerias' },
  { icon: ShieldCheck, label: 'Sem taxa ou comissão' },
];

export const BENEFITS_TRANSFER: BenefitItem[] = [
  { icon: Users, label: 'Galerias atreladas ao cliente' },
  { icon: Camera, label: 'Entrega profissional' },
  { icon: ShieldCheck, label: 'Acesso rápido e estável' },
  { icon: Image, label: 'Expansão conforme necessidade' },
  { icon: Check, label: 'Download do arquivo original' },
];

export const FALLBACK_COMBO_PLANS = [
  {
    code: 'combo_pro_select2k',
    name: 'Studio Pro + Select 2k',
    monthlyPrice: 4490,
    yearlyPrice: 45259,
    credits: 2000,
    benefits: [
      'Sistema completo de gestão',
      '2.000 créditos mensais',
      'Integração automática com Gallery',
      'Controle de clientes',
      'Fluxo de trabalho',
      'Automações de pagamentos',
    ],
    buttonLabel: 'Assinar',
    highlight: false,
  },
  {
    code: 'combo_completo',
    name: 'Studio Pro + Select 2k + Transfer 20GB',
    monthlyPrice: 6490,
    yearlyPrice: 66198,
    credits: 2000,
    benefits: [
      'Gestão completa',
      '2.000 créditos mensais',
      '20GB de armazenamento profissional',
      'Entrega profissional no seu estilo',
    ],
    buttonLabel: 'Assinar',
    highlight: true,
    tag: 'Mais completo',
  },
];

export const FALLBACK_TRANSFER_PLANS = [
  { code: 'transfer_5gb', name: '5GB', monthlyPrice: 1290, yearlyPrice: 12384, storage: '5GB', highlight: false },
  {
    code: 'transfer_20gb',
    name: '20GB',
    monthlyPrice: 2490,
    yearlyPrice: 23904,
    storage: '20GB',
    highlight: true,
    tag: 'Mais escolhido',
  },
  { code: 'transfer_50gb', name: '50GB', monthlyPrice: 3490, yearlyPrice: 33504, storage: '50GB', highlight: false },
  { code: 'transfer_100gb', name: '100GB', monthlyPrice: 5990, yearlyPrice: 57504, storage: '100GB', highlight: false },
];

export const COMPARISON_ROWS = [
  { label: 'Preço', avulso: 'A partir de R$ 19,90', pro: '', full: '' },
  { label: 'Clientes ilimitados', avulso: true, pro: true, full: true },
  { label: 'Galerias ilimitadas', avulso: true, pro: true, full: true },
  { label: 'Resolução até 2560px', avulso: true, pro: true, full: true },
  { label: 'Créditos mensais', avulso: false, pro: '2.000', full: '2.000' },
  { label: 'Armazenamento', avulso: false, pro: false, full: '20GB' },
  { label: 'Gestão de clientes', avulso: false, pro: true, full: true },
  { label: 'Controle financeiro', avulso: false, pro: true, full: true },
  { label: 'Entrega profissional', avulso: false, pro: false, full: true },
];
