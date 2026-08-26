import { useEffect, useState } from 'react';
import { ChargeModal } from './ChargeModal';
import { useGalleryExtraCalc } from '@/hooks/useGalleryExtraCalc';
import { supabase } from '@/integrations/supabase/client';

export interface ExtraChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  galeriaId: string;
  clienteId?: string;
  clienteNome?: string;
  nomeSessao?: string;
  clienteWhatsapp?: string;
  /** Quando presente, exibe stepper no header (fluxo "Cobrar tudo"). */
  step?: import('./ChargeStepBadge').ChargeStep | null;
}

export function ExtraChargeModal({
  isOpen,
  onClose,
  galeriaId,
  clienteId: propClienteId,
  clienteNome: propClienteNome,
  nomeSessao: propNomeSessao,
  clienteWhatsapp: propClienteWhatsapp,
  step,
}: ExtraChargeModalProps) {
  const { calc } = useGalleryExtraCalc(isOpen ? galeriaId : null);
  const [clienteId, setClienteId] = useState(propClienteId || '');
  const [clienteNome, setClienteNome] = useState(propClienteNome || '');
  const [clienteWhatsapp, setClienteWhatsapp] = useState(propClienteWhatsapp || '');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [nomeSessao, setNomeSessao] = useState(propNomeSessao || '');

  useEffect(() => {
    if (!isOpen || !galeriaId) return;

    if (propClienteId) setClienteId(propClienteId);
    if (propClienteNome) setClienteNome(propClienteNome);
    if (propClienteWhatsapp) setClienteWhatsapp(propClienteWhatsapp);
    if (propNomeSessao) setNomeSessao(propNomeSessao);

    // Complementar dados da galeria / cliente se faltar algum
    (async () => {
      try {
        const { data: gal } = await supabase
          .from('galerias')
          .select('cliente_id, session_id, nome_sessao')
          .eq('id', galeriaId)
          .maybeSingle();

        if (gal) {
          if (!propNomeSessao && gal.nome_sessao) setNomeSessao(gal.nome_sessao);
          if (gal.session_id) setSessionId(gal.session_id);
          const cId = propClienteId || gal.cliente_id;
          if (cId) {
            setClienteId(cId);
            if (!propClienteNome || !propClienteWhatsapp) {
              const { data: cli } = await supabase
                .from('clientes')
                .select('nome, whatsapp, telefone')
                .eq('id', cId)
                .maybeSingle();
              if (cli) {
                if (!propClienteNome && cli.nome) setClienteNome(cli.nome);
                if (!propClienteWhatsapp) setClienteWhatsapp(cli.whatsapp || cli.telefone || '');
              }
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar dados da galeria no ExtraChargeModal:', err);
      }
    })();
  }, [isOpen, galeriaId, propClienteId, propClienteNome, propClienteWhatsapp, propNomeSessao]);

  if (!isOpen) return null;

  const extrasQtd = calc.extras_a_cobrar || (calc.extras_necessarias - calc.extras_pagas) || 0;

  return (
    <ChargeModal
      isOpen={isOpen}
      onClose={onClose}
      clienteId={clienteId}
      clienteNome={clienteNome || 'Cliente'}
      clienteWhatsapp={clienteWhatsapp}
      sessionId={sessionId}
      valorSugerido={calc.valor_a_cobrar}
      finalidade="fotos_extras"
      galeriaId={galeriaId}
      qtdFotos={extrasQtd}
      snapshotFotosIncluidas={calc.included_count ?? null}
      nomeSessao={nomeSessao}
      step={step}
    />
  );
}
