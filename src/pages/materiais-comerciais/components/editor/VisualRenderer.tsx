import React from 'react';
import { BlockData } from '@/hooks/useMaterialEditor';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface VisualRendererProps {
  blocks: BlockData[];
  activeIndex: number;
  onSelectBlock: (index: number) => void;
  viewMode: 'desktop' | 'mobile';
}

// ---------------------------------------------------------
// Componentes Individuais de Renderização
// ---------------------------------------------------------

function CoverRenderer({ data }: { data: any }) {
  return (
    <section className="relative flex flex-col md:flex-row items-center min-h-[500px] bg-[#FDFBF7] p-8 md:p-16 gap-12 overflow-hidden">
      {/* Texto */}
      <div className="flex-1 flex flex-col items-start z-10">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-[#2C2825] leading-[1.1] tracking-tight max-w-[15ch] mb-6">
          {data?.title || 'Seu momento merece ser vivido e lembrado para sempre.'}
        </h1>
        <p className="text-[#6D655E] text-lg max-w-[40ch] mb-10 leading-relaxed font-light">
          {data?.subtitle || 'Fotografias que eternizam a espera do seu maior amor com leveza, verdade e emoção.'}
        </p>
        {(data?.btnText || 'Quero viver essa experiência') && (
          <Button className="bg-[#C86A46] hover:bg-[#B35C3B] text-white rounded-none px-8 py-6 h-auto text-sm font-medium tracking-wide">
            {data?.btnText || 'Quero viver essa experiência'}
          </Button>
        )}
      </div>

      {/* Imagem */}
      <div className="flex-1 w-full h-[400px] md:h-[600px] relative rounded-[2rem] overflow-hidden shadow-2xl">
        <img 
          src={data?.image_url || 'https://images.unsplash.com/photo-1518063063544-236b2bb6f0b4?q=80&w=1000&auto=format&fit=crop'} 
          alt="Capa"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    </section>
  );
}

function PackageRenderer({ data }: { data: any }) {
  return (
    <section className="py-16 px-8 bg-white flex flex-col items-center">
      <div className="w-full max-w-md bg-white border border-[#EBE5DF] rounded-2xl p-8 shadow-sm flex flex-col relative transition-all hover:shadow-md">
        {/* Highlight Badge */}
        {data?.highlight && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F3EBE1] text-[#A67C52] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            Mais Escolhido
          </div>
        )}
        
        <h3 className="text-2xl font-serif text-[#2C2825] mb-2">{data?.title || 'Essencial'}</h3>
        <p className="text-sm text-[#6D655E] mb-6">{data?.subtitle || 'Para quem deseja registros leves e naturais.'}</p>
        
        <div className="flex-1">
          <p className="text-sm text-[#4A4541] whitespace-pre-line leading-loose">
            {data?.description || '10 fotos digitais\n1h de ensaio\nGaleria online'}
          </p>
        </div>
        
        <div className="mt-8 pt-6 border-t border-[#F2EFEA] flex items-center justify-between">
          <span className="text-2xl font-medium text-[#2C2825]">
            R$ {((data?.price_cents || 129000) / 100).toLocaleString('pt-BR')}
          </span>
          <Button variant="outline" className="border-[#D8D2CB] text-[#2C2825] hover:bg-[#FDFBF7] rounded-none">
            Escolher pacote
          </Button>
        </div>
      </div>
    </section>
  );
}

function DefaultRenderer({ block }: { block: BlockData }) {
  return (
    <section className="py-16 px-8 bg-white text-center">
      <h2 className="text-3xl font-serif text-[#2C2825] mb-4">{block.data?.title || block.type}</h2>
      <p className="text-[#6D655E] max-w-2xl mx-auto whitespace-pre-line">
        {block.data?.content || block.data?.description || 'Conteúdo da seção será exibido aqui.'}
      </p>
    </section>
  );
}

// ---------------------------------------------------------
// Orquestrador Principal
// ---------------------------------------------------------

export function VisualRenderer({ blocks, activeIndex, onSelectBlock, viewMode }: VisualRendererProps) {
  return (
    <div className="w-full h-full p-4 md:p-8 flex items-start justify-center transition-all duration-300">
      <div 
        className={cn(
          "bg-white shadow-2xl overflow-y-auto overflow-x-hidden relative transition-all duration-500 origin-top flex flex-col",
          viewMode === 'desktop' ? "w-full max-w-5xl rounded-sm min-h-full" : "w-[375px] h-[812px] rounded-[3rem] border-[12px] border-zinc-900 shadow-2xl"
        )}
      >
        {blocks.map((block, index) => {
          const isActive = index === activeIndex;
          return (
            <div 
              key={index}
              onClick={() => onSelectBlock(index)}
              className={cn(
                "relative group cursor-pointer transition-all duration-200 outline outline-2 outline-transparent outline-offset-[-2px]",
                isActive ? "outline-primary z-10 shadow-[0_0_0_4px_rgba(200,106,70,0.1)]" : "hover:outline-primary/30"
              )}
            >
              {/* Overlay de clique */}
              <div className={cn(
                "absolute inset-0 z-20 pointer-events-none transition-colors",
                !isActive && "group-hover:bg-primary/5"
              )} />
              
              {/* Renderização condicional por tipo */}
              <div className="pointer-events-none">
                {block.type === 'cover' && <CoverRenderer data={block.data} />}
                {block.type === 'package' && <PackageRenderer data={block.data} />}
                {block.type !== 'cover' && block.type !== 'package' && <DefaultRenderer block={block} />}
              </div>
            </div>
          );
        })}

        {blocks.length === 0 && (
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground font-medium">A proposta está vazia. Adicione seções.</p>
          </div>
        )}
      </div>
    </div>
  );
}
