import React from 'react';
import { BlockData } from '@/hooks/useMaterialEditor';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface VisualRendererProps {
  blocks: BlockData[];
  activeIndex: number;
  onSelectBlock: (index: number) => void;
  viewMode: 'desktop' | 'mobile';
  onSectionView?: (blockId: string, blockType: string, position: number) => void;
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
      <h2 className="text-3xl font-serif text-[#2C2825] mb-4">{block.data?.title || block.content?.title || block.type}</h2>
      <p className="text-[#6D655E] max-w-2xl mx-auto whitespace-pre-line">
        {block.data?.content || block.data?.description || block.content?.body || 'Conteúdo da seção será exibido aqui.'}
      </p>
    </section>
  );
}

function EditorialRenderer({ data, content, props }: { data?: any, content?: any, props?: any }) {
  // Use `content` e `props` do novo formato (bloco v2) ou `data` (fallback v1)
  const c = content || data || {};
  const p = props || {};
  
  const bgClass = p.background === 'dark' ? 'bg-[#1A1714] text-white' : p.background === 'cream' ? 'bg-[#F3F0EA] text-[#1A1714]' : 'bg-white text-[#1A1714]';
  const textColor = p.background === 'dark' ? 'text-white' : 'text-[#1A1714]';
  const mutedTextColor = p.background === 'dark' ? 'text-white/40' : 'text-[#8C7B6E]';
  const borderColor = p.background === 'dark' ? 'border-white/10' : 'border-[#1A1714]/10';

  return (
    <section className={cn("py-16 md:py-28 px-6 md:px-14 overflow-hidden", bgClass)}>
      <div className="max-w-[900px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-24 items-center">
          
          {/* Visual (Photos) */}
          <div className="relative h-[280px] md:h-[520px]">
            {/* Photo A */}
            <div 
              className="absolute top-0 left-0 rounded-[3px] overflow-hidden"
              style={{
                width: `${p.photo_a?.width_pct || 72}%`,
                height: `${p.photo_a?.height_pct || 80}%`,
                background: p.photo_a?.image_ref 
                  ? `url(${p.photo_a.image_ref}) center/cover` 
                  : `linear-gradient(${p.photo_a?.placeholder_gradient?.angle_deg || 148}deg, ${p.photo_a?.placeholder_gradient?.from || '#96724e'} 0%, ${p.photo_a?.placeholder_gradient?.to || '#3d2010'} 100%)`
              }}
            />
            {/* Photo B */}
            <div 
              className="absolute bottom-0 right-0 rounded-[3px] overflow-hidden mix-blend-screen"
              style={{
                width: `${p.photo_b?.width_pct || 62}%`,
                height: `${p.photo_b?.height_pct || 66}%`,
                background: p.photo_b?.image_ref 
                  ? `url(${p.photo_b.image_ref}) center/cover` 
                  : `linear-gradient(${p.photo_b?.placeholder_gradient?.angle_deg || 148}deg, ${p.photo_b?.placeholder_gradient?.from || '#e8d0a8'} 0%, ${p.photo_b?.placeholder_gradient?.to || '#8c6040'} 100%)`
              }}
            />
            {c.vertical_label && (
              <p 
                className="hidden md:block absolute bottom-8 -left-5 text-[10px] tracking-[0.35em] uppercase text-white/20 uppercase"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
              >
                {c.vertical_label}
              </p>
            )}
          </div>

          {/* Text Content */}
          <div className="flex flex-col">
            {c.eyebrow && (
              <span className="text-[10px] font-medium tracking-[0.28em] uppercase text-white/30 mb-4 block font-sans">
                {c.eyebrow}
              </span>
            )}
            
            <h2 className="text-4xl md:text-5xl lg:text-[4rem] font-serif font-light leading-[1.02] tracking-[0.03em] mb-10">
              {c.title}
              {c.title_italic && <><br /><em className="italic text-white/45">{c.title_italic}</em></>}
            </h2>

            {c.details && c.details.length > 0 && (
              <div className="flex flex-col gap-0 mb-9">
                {c.details.map((detail: any, idx: number) => (
                  <div key={detail.id || idx} className={cn("flex justify-between items-baseline gap-6 py-3 border-b", borderColor, idx === 0 && "border-t")}>
                    <span className="font-sans text-[10px] font-medium tracking-[0.24em] uppercase text-white/30 whitespace-nowrap">
                      {detail.label}
                    </span>
                    <span className="font-serif text-base font-light text-white/75 text-right">
                      {detail.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {c.body && (
              <p className="font-serif italic text-base md:text-[1.1rem] font-light leading-[1.7] text-white/40">
                {c.body}
              </p>
            )}
          </div>
          
        </div>
      </div>
    </section>
  );
}

function PricingTableRenderer({ content, data }: { content?: any, data?: any }) {
  const c = content || data || {};
  return (
    <section className="py-16 md:py-24 px-6 md:px-14 bg-white text-center">
      <div className="max-w-[900px] mx-auto">
        {c.eyebrow && <p className="text-[10px] font-medium tracking-[0.28em] uppercase text-[#8C7B6E] mb-4">{c.eyebrow}</p>}
        <h2 className="text-4xl md:text-5xl font-serif text-[#1A1714] mb-12">{c.title || 'Pacotes'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          {(c.packages || []).map((pkg: any, idx: number) => (
            <div key={pkg.id || idx} className="border border-[#E8E3DA] p-8 rounded-sm bg-[#FDFBF7] flex flex-col relative overflow-hidden">
              {pkg.badge && (
                <div className="absolute top-0 right-0 bg-[#F3F0EA] text-[10px] font-medium tracking-[0.28em] uppercase text-[#8C7B6E] px-3 py-1 border-b border-l border-[#E8E3DA]">
                  {pkg.badge}
                </div>
              )}
              <h3 className="text-2xl font-serif text-[#1A1714] mb-2 pr-6">{pkg.name}</h3>
              <p className="text-xl text-[#7A5C42] mb-6">{pkg.price} <span className="text-sm text-[#8C7B6E] font-light">/{pkg.price_unit}</span></p>
              <ul className="space-y-3 flex-1 mb-8">
                {(pkg.features || []).map((feat: string, i: number) => (
                  <li key={i} className="text-sm font-light text-[#1A1714]/70 border-b border-[#E8E3DA] pb-2 last:border-0">{feat}</li>
                ))}
              </ul>
              {pkg.image_ref && (
                <div className="h-32 w-full mt-auto mb-6 rounded-sm bg-cover bg-center" style={{ backgroundImage: `url(${pkg.image_ref})` }} />
              )}
              <Button variant="outline" className="w-full border-[#1A1714] text-[#1A1714] rounded-none hover:bg-[#1A1714] hover:text-white transition-colors">
                Selecionar
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialRenderer({ content, data }: { content?: any, data?: any }) {
  const c = content || data || {};
  return (
    <section className="py-16 md:py-24 px-6 md:px-14 bg-[#F3F0EA] text-center">
      <div className="max-w-[900px] mx-auto">
        {c.eyebrow && <p className="text-[10px] font-medium tracking-[0.28em] uppercase text-[#8C7B6E] mb-4">{c.eyebrow}</p>}
        <h2 className="text-4xl md:text-5xl font-serif text-[#1A1714] mb-12">{c.title || 'Depoimentos'}</h2>
        <div className="flex flex-nowrap overflow-x-auto gap-8 pb-8 snap-x">
          {(c.items || []).map((item: any, idx: number) => (
            <div key={item.id || idx} className="min-w-[80%] md:min-w-[400px] snap-center bg-white p-8 rounded-sm text-left flex flex-col shadow-sm">
              <span className="text-4xl text-[#C9BFB2] font-serif leading-none mb-4">"</span>
              <p className="font-serif italic text-[#1A1714]/80 text-lg leading-relaxed mb-6 flex-1">
                {item.quote}
              </p>
              <div>
                <p className="font-bold text-sm text-[#1A1714] uppercase tracking-wider">{item.author}</p>
                <p className="text-xs text-[#8C7B6E] uppercase tracking-widest mt-1">{item.service}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTABlockRenderer({ content, data }: { content?: any, data?: any }) {
  const c = content || data || {};
  return (
    <section className="py-24 md:py-32 px-6 md:px-14 bg-white text-center flex flex-col items-center">
      <h2 className="text-4xl md:text-6xl font-serif text-[#1A1714] mb-12 max-w-2xl whitespace-pre-line leading-tight">
        {c.cta_text || 'Vamos conversar?'}
      </h2>
      <Button className="bg-[#1A1714] hover:bg-[#1A1714]/90 text-white rounded-none px-12 py-6 text-sm font-bold tracking-widest uppercase mb-12">
        Entrar em Contato
      </Button>
      <div className="flex flex-wrap justify-center gap-6">
        {(c.links || []).map((link: any, idx: number) => (
          <a key={link.id || idx} href={link.href} className="text-xs font-medium tracking-widest uppercase text-[#8C7B6E] hover:text-[#1A1714] transition-colors">
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}

function GalleryRenderer({ content, data }: { content?: any, data?: any }) {
  const c = content || data || {};
  return (
    <section className="py-16 md:py-24 px-6 md:px-14 bg-[#1A1714] text-center text-white">
      <div className="max-w-[900px] mx-auto">
        {c.eyebrow && <p className="text-[10px] font-medium tracking-[0.28em] uppercase text-white/40 mb-4">{c.eyebrow}</p>}
        <h2 className="text-4xl md:text-5xl font-serif mb-4">{c.title || 'Portfólio'}</h2>
        {c.caption && <p className="font-serif italic text-white/50 mb-12">{c.caption}</p>}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 auto-rows-[150px] md:auto-rows-[250px]">
          {(c.images || []).map((img: any, idx: number) => (
            <div 
              key={idx} 
              className={cn(
                "rounded-sm overflow-hidden bg-white/5",
                img.span === 'tall_2rows' && "row-span-2",
                img.span === 'wide_2cols' && "col-span-2",
              )}
            >
              {img.image_ref ? (
                <img src={img.image_ref} alt="Gallery" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" style={{ backgroundColor: img.placeholder_hex || '#2f2318' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FooterTermsRenderer({ content, data }: { content?: any, data?: any }) {
  const c = content || data || {};
  return (
    <footer className="py-8 px-6 bg-[#F3F0EA] text-center text-[#8C7B6E] text-[10px] font-medium tracking-widest uppercase border-t border-[#E8E3DA]">
      {c.copyright || '© Todos os direitos reservados'}
    </footer>
  );
}


// ---------------------------------------------------------
// Observer de Blocos para Rastreio
// ---------------------------------------------------------
function BlockObserver({ 
  children, 
  blockId, 
  blockType, 
  position, 
  onView 
}: { 
  children: React.ReactNode, 
  blockId: string, 
  blockType: string, 
  position: number, 
  onView?: (blockId: string, blockType: string, position: number) => void 
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [viewed, setViewed] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current || viewed || !onView) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        onView(blockId, blockType, position);
        setViewed(true);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [viewed, onView, blockId, blockType, position]);

  return <div ref={ref} className="h-full w-full">{children}</div>;
}

// ---------------------------------------------------------
// Orquestrador Principal
// ---------------------------------------------------------

export function VisualRenderer({ blocks, activeIndex, onSelectBlock, viewMode, onSectionView }: VisualRendererProps) {
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
              
              {/* Renderização condicional por tipo com Observer para Analytics */}
              <div className="pointer-events-none">
                <BlockObserver 
                  blockId={block.id} 
                  blockType={block.type} 
                  position={index} 
                  onView={onSectionView}
                >
                  {block.type === 'cover' && <CoverRenderer data={block.data} />}
                  {block.type === 'CoverBlock' && <CoverRenderer data={block.content || block.data} />}
                  {block.type === 'package' && <PackageRenderer data={block.data} />}
                  {block.type === 'EditorialBlock' && <EditorialRenderer content={block.content} data={block.data} props={block.props} />}
                  {block.type === 'PricingTable' && <PricingTableRenderer content={block.content} data={block.data} />}
                  {block.type === 'TestimonialBlock' && <TestimonialRenderer content={block.content} data={block.data} />}
                  {block.type === 'Gallery' && <GalleryRenderer content={block.content} data={block.data} />}
                  {block.type === 'CTABlock' && <CTABlockRenderer content={block.content} data={block.data} />}
                  {block.type === 'FooterTerms' && <FooterTermsRenderer content={block.content} data={block.data} />}
                  {block.type !== 'cover' && block.type !== 'CoverBlock' && block.type !== 'package' && block.type !== 'EditorialBlock' && block.type !== 'PricingTable' && block.type !== 'TestimonialBlock' && block.type !== 'Gallery' && block.type !== 'CTABlock' && block.type !== 'FooterTerms' && <DefaultRenderer block={block} />}
                </BlockObserver>
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
