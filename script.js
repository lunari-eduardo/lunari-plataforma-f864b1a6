const fs = require('fs');
let code = fs.readFileSync('src/pages/comercial/components/editor/VisualRenderer.tsx', 'utf8');

// Update PricingClassic
code = code.replace(/className="border border-current\/10 p-8 rounded-sm bg-\[var\(--pa-white,#FDFBF7\)\] flex flex-col relative overflow-hidden"/g, 'className="border border-black/5 shadow-sm p-8 rounded-2xl bg-[var(--pa-white,#FDFBF7)] text-neutral-900 flex flex-col relative overflow-hidden"');
code = code.replace(/border-b border-l border-current\/10"/g, 'border-b border-l border-black/5 rounded-bl-xl"');
code = code.replace(/<div className="h-36 w-full mb-6 rounded-sm overflow-hidden relative bg-black\/5">/g, '<div className="h-36 w-full mb-6 rounded-xl overflow-hidden relative bg-black/5">');
code = code.replace(/border-b border-current\/10/g, 'border-b border-black/5');

// Update button in PricingClassic
const oldButton = \              <Button
                variant="outline"
                className="w-full border-current rounded-none hover:bg-current/90 transition-colors"
                onClick={() => onCtaClick?.({ blockType: 'PricingTable', label: pkg.name })}
              >
                Selecionar
              </Button>\;
const newButton = \              {!props?.hide_cta && (
                <Button
                  variant="outline"
                  className="w-full bg-[#2C2825] border-transparent text-white hover:bg-[#2C2825]/80 hover:text-white rounded-xl transition-colors"
                  onClick={() => onCtaClick?.({ blockType: 'PricingTable', label: pkg.name })}
                >
                  Selecionar
                </Button>
              )}\;
code = code.replace(oldButton, newButton);

// Hide images in PricingClassic
const oldImg = \{(pkg.image_ref || editable) && (\;
const newImg = \{!props?.hide_images && (pkg.image_ref || editable) && (\;
code = code.replace(oldImg, newImg);
code = code.replace(/onCommit=\\{\\(url\\) => inline\\?\\.set\\(\\\packages\\.\\\$\\{idx\\}\\.image_ref\\\, url\\)\\}/g, 'onCommit={(url) => inline?.set(packages..image_ref, url)}\n                    publicEmptyClassName="hidden"');

// Add PricingCardsMinimal before PricingNumberedEditorial
const minimalCode = \
function PricingCardsMinimal({ content, data, props, onCtaClick }: { content?: any; data?: any; props?: any; onCtaClick?: CtaHandler }) {
  const inline = useInlineEdit();
  const editable = inline?.editable ?? false;
  const et = (path: string, value: string | undefined) => ({ editable, value: value ?? '', onCommit: (v: string) => inline?.set(path, v) });
  const c = content || data || {};
  const packages: any[] = c.packages || [];
  const align = alignClass(props?.align, 'center');
  const colsClass = packages.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' : packages.length === 2 ? 'grid-cols-1 @md:grid-cols-2 max-w-[700px] mx-auto' : 'grid-cols-1 @md:grid-cols-3';

  return (
    <section className={cn('py-16 @md:py-24 px-6 @md:px-14', sectionBg(props?.background, 'white'), align)}>
      <div className="max-w-[1000px] mx-auto">
        <EditableText as="p" {...et('eyebrow', c.eyebrow)} className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-50 mb-4 text-center" />
        <EditableText as="h2" {...et('title', c.title)} className="text-4xl @md:text-5xl mb-16 text-center" style={fd()} />
        
        <div className={cn('grid gap-10 @md:gap-14 text-center', colsClass)}>
          {packages.map((pkg: any, idx: number) => (
            <div key={pkg.id || idx} className="flex flex-col relative text-neutral-900">
              
              {!props?.hide_images && (pkg.image_ref || editable) && (
                <div className="aspect-[4/5] w-full mb-8 rounded-3xl overflow-hidden relative bg-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] group/card">
                  <EditableImage
                    editable={editable}
                    value={pkg.image_ref || null}
                    label="Foto do pacote"
                    alt={pkg.name || 'Pacote'}
                    onCommit={(url) => inline?.set(\\\packages.\\\.image_ref\\\, url)}
                    className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover/card:scale-105"
                    imgClassName="object-cover w-full h-full"
                    publicEmptyClassName="hidden"
                  />
                  {pkg.badge && (
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-[9px] font-medium tracking-[0.2em] uppercase text-neutral-900 px-3 py-1.5 rounded-full shadow-sm">
                      <EditableText {...et(\\\packages.\\\.badge\\\, pkg.badge)} />
                    </div>
                  )}
                </div>
              )}

              {(!pkg.image_ref && !editable) && pkg.badge && (
                <div className="inline-block mx-auto bg-black/5 text-[9px] font-medium tracking-[0.2em] uppercase text-neutral-900 px-3 py-1 mb-4 rounded-full">
                  <EditableText {...et(\\\packages.\\\.badge\\\, pkg.badge)} />
                </div>
              )}

              <EditableText as="h3" {...et(\\\packages.\\\.name\\\, pkg.name)} className="text-2xl @md:text-3xl mb-3" style={fd()} />
              
              <p className="text-xl text-[var(--pa-accent,#7A5C42)] mb-8 font-light">
                <EditableText {...et(\\\packages.\\\.price\\\, pkg.price)} placeholder="R$" />
                <span className="text-sm opacity-50">/<EditableText {...et(\\\packages.\\\.price_unit\\\, pkg.price_unit)} placeholder="un." /></span>
              </p>

              <ul className="space-y-4 flex-1 mb-10 text-sm font-light opacity-75">
                {(pkg.features || []).map((feat: string, i: number) => (
                  <li key={i}>
                    <EditableText {...et(\\\packages.\\\.features.\\\\\\, feat)} placeholder="Item incluso" />
                  </li>
                ))}
              </ul>

              {!props?.hide_cta && (
                <Button
                  variant="outline"
                  className="w-[80%] mx-auto bg-transparent border-black/20 text-neutral-900 hover:bg-neutral-900 hover:text-white rounded-full transition-all"
                  onClick={() => onCtaClick?.({ blockType: 'PricingTable', label: pkg.name })}
                >
                  Selecionar
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingNumberedEditorial\;
code = code.replace(/function PricingNumberedEditorial/g, minimalCode);

// Add to dispatcher
const oldDispatcher = \unction PricingTableRenderer({ content, data, props, onCtaClick }: { content?: any; data?: any; props?: any; onCtaClick?: CtaHandler }) {
  const variant = props?.variant || 'cards-classic';
  switch (variant) {
    case 'numbered-editorial':
      return <PricingNumberedEditorial content={content} data={data} props={props} />;\;
const newDispatcher = \unction PricingTableRenderer({ content, data, props, onCtaClick }: { content?: any; data?: any; props?: any; onCtaClick?: CtaHandler }) {
  const variant = props?.variant || 'cards-classic';
  switch (variant) {
    case 'numbered-editorial':
      return <PricingNumberedEditorial content={content} data={data} props={props} />;
    case 'cards-minimal':
      return <PricingCardsMinimal content={content} data={data} props={props} onCtaClick={onCtaClick} />;\;
code = code.replace(oldDispatcher, newDispatcher);

// Hide CTA & Image in PricingNumberedEditorial
code = code.replace(/\{\/\* Lado da foto \*\/\}/g, '{/* Lado da foto */}\n                  {!props?.hide_images && (pkg.image_ref || editable) && (');
code = code.replace(/<\/EditableImage>\n                  <\/div>/g, '</EditableImage>\n                  </div>\n                  )}');

fs.writeFileSync('src/pages/comercial/components/editor/VisualRenderer.tsx', code);
