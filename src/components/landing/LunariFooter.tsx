import { displayFont, uiFont } from "./primitives";

export function LunariFooter() {
  return (
    <footer className="border-t border-[#0A0A0A]/8 bg-[#FAFAF7] py-14">
      <div className="mx-auto max-w-[1200px] px-6 md:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <div
              className="text-[22px] font-medium text-[#0A0A0A]"
              style={displayFont}
            >
              lunari
            </div>
            <p className="mt-3 max-w-[220px] text-[13px] leading-[1.5] text-[#0A0A0A]/55" style={uiFont}>
              O primeiro sistema que pensa como um fotógrafo.
            </p>
          </div>

          <FooterCol title="Produto" links={["Recursos", "Galeria", "Assistente IA", "Planos"]} />
          <FooterCol title="Estúdio" links={["Sobre", "Blog", "Contato", "Suporte"]} />
          <FooterCol title="Legal" links={["Termos", "Privacidade", "LGPD", "Segurança"]} />
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[#0A0A0A]/8 pt-8 text-[12px] text-[#0A0A0A]/45 md:flex-row md:items-center" style={uiFont}>
          <span>© 2026 Lunari · Feito para fotógrafos, no Brasil.</span>
          <span>hello@lunarihub.com</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div style={uiFont}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#0A0A0A]/50">
        {title}
      </div>
      <ul className="mt-4 space-y-2">
        {links.map((l) => (
          <li key={l}>
            <a href="#" className="text-[13px] text-[#0A0A0A]/75 hover:text-[#0A0A0A]">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
