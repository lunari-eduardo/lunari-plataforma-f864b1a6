import { ChargeModal } from './ChargeModal';

export interface CombinedChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome: string;
  clienteWhatsapp?: string;
  sessionId: string;
  galeriaId?: string | null;
  valorSessaoComponente: number;
  valorExtrasComponente: number;
  qtdFotosExtras: number;
  snapshotFotosIncluidas?: number | null;
  nomeSessao?: string;
  step?: import('./ChargeStepBadge').ChargeStep | null;
}

export function CombinedChargeModal({
  isOpen,
  onClose,
  clienteId,
  clienteNome,
  clienteWhatsapp,
  sessionId,
  galeriaId,
  valorSessaoComponente,
  valorExtrasComponente,
  qtdFotosExtras,
  snapshotFotosIncluidas,
  nomeSessao,
  step,
}: CombinedChargeModalProps) {
  if (!isOpen) return null;

  const soExtras = valorSessaoComponente <= 0 && valorExtrasComponente > 0;
  const valorTotal = Number((valorSessaoComponente + valorExtrasComponente).toFixed(2));

  return (
    <ChargeModal
      isOpen={isOpen}
      onClose={onClose}
      clienteId={clienteId}
      clienteNome={clienteNome}
      clienteWhatsapp={clienteWhatsapp}
      sessionId={sessionId}
      galeriaId={galeriaId}
      valorSugerido={valorTotal}
      finalidade={soExtras ? 'fotos_extras' : 'sessao_e_extras'}
      valorSessaoComponente={valorSessaoComponente}
      valorExtrasComponente={valorExtrasComponente}
      qtdFotos={qtdFotosExtras}
      snapshotFotosIncluidas={snapshotFotosIncluidas}
      nomeSessao={nomeSessao}
      step={step}
    />
  );
}
