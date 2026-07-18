import { NavLink } from "react-router-dom";
import { displayFont, uiFont } from "@/components/landing/primitives";

const COLS: { title: string; links: { label: string; to: string; external?: boolean }[] }[] = [
  {
    title: "Produtos",
    links: [
      { label: "Lunari Studio", to: "/studio" },
      { label: "Gallery Select", to: "/gallery/select" },
      { label: "Gallery Transfer", to: "/gallery/transfer" },
      { label: "Preços", to: "/precos" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre", to: "/sobre" },
      { label: "Contato", to: "/contato" },
      { label: "Blog", to: "/conteudos" },
      { label: "Central de ajuda", to: "/app/ajuda" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Termos de uso", to: "/legal/termos" },
      { label: "Privacidade", to: "/legal/privacidade" },
      { label: "LGPD", to: "/legal/lgpd" },
      { label: "Segurança", to: "/legal/seguranca" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[#0A0A0A]/8 bg-[#FAFAF7] py-16">
      <div className="mx-auto max-w-[1200px] px-6 md:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div>
            <NavLink
              to="/"
              className="inline-flex items-center gap-2 text-[22px] font-medium text-[#0A0A0A]"
              style={{ fontFamily: '"Geist", sans-serif', letterSpacing: "-0.02em" }}
            >
              <span
                className="inline-block h-[7px] w-[7px] rounded-full"
                style={{ background: "#b0632f", boxShadow: "0 0 0 3px rgba(176,99,47,0.12)" }}
              />
              lunari
              <span
                className="ml-1 text-[10px] font-normal uppercase tracking-[0.18em] text-[rgba(10,10,10,0.4)]"
                style={{ fontFamily: '"Geist Mono", monospace' }}
              >
                hub
              </span>
            </NavLink>
            <p
              className="mt-4 max-w-[240px] text-[13px] leading-[1.55] text-[#0A0A0A]/55"
              style={uiFont}
            >
              O primeiro sistema que pensa como um fotógrafo. Studio + Gallery em um cérebro só.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title} style={uiFont}>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#0A0A0A]/50">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <NavLink
                      to={l.to}
                      className="text-[13px] text-[#0A0A0A]/75 transition-colors hover:text-[#0A0A0A]"
                    >
                      {l.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[#0A0A0A]/8 pt-8 text-[12px] text-[#0A0A0A]/45 md:flex-row md:items-center"
          style={uiFont}
        >
          <span>© {new Date().getFullYear()} Lunari · Feito para fotógrafos, no Brasil.</span>
          <a href="mailto:hello@lunarihub.com" className="hover:text-[#0A0A0A]">
            hello@lunarihub.com
          </a>
        </div>
      </div>
    </footer>
  );
}
