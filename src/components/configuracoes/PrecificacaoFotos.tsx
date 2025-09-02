import { PricingContainer } from './pricing/PricingContainer';
interface PrecificacaoFotosProps {
  categorias: Array<{
    id: string;
    nome: string;
    cor: string;
  }>;
}

export default function PrecificacaoFotos({ categorias }: PrecificacaoFotosProps) {
  return <PricingContainer categorias={categorias} />;
}