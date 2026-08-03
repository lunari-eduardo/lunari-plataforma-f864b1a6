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
      { label: "Exclusão de dados", to: "/legal/exclusao-dados" },
      { label: "Segurança", to: "/legal/seguranca" },

    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#0A0A0A] py-16">
      <div className="mx-auto max-w-[1200px] px-6 md:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div>
            <NavLink
              to="/"
              className="inline-flex items-center gap-2 text-[22px] font-medium text-[#F5F1EA]"
              style={{ fontFamily: '"Geist", sans-serif', letterSpacing: "-0.02em" }}
            >
              <span
                className="inline-block h-[7px] w-[7px] rounded-full"
                style={{ background: "#C9A87C", boxShadow: "0 0 0 3px rgba(201,168,124,0.14)" }}
              />
              lunari
              <span
                className="ml-1 text-[10px] font-normal uppercase tracking-[0.18em] text-[rgba(245,241,234,0.42)]"
                style={{ fontFamily: '"Geist Mono", monospace' }}
              >
                hub
              </span>
            </NavLink>
            <p
              className="mt-4 max-w-[240px] text-[13px] leading-[1.55] text-[#F5F1EA]/60"
              style={uiFont}
            >
              O primeiro sistema que pensa como um fotógrafo. Studio + Gallery em um cérebro só.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title} style={uiFont}>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#F5F1EA]/50">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <NavLink
                      to={l.to}
                      className="text-[13px] text-[#F5F1EA]/70 transition-colors hover:text-[#C9A87C]"
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
          className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/8 pt-8 text-[12px] text-[#F5F1EA]/45 md:flex-row md:items-center"
          style={uiFont}
        >
          <span>© {new Date().getFullYear()} Lunari · Feito para fotógrafos, no Brasil.</span>
          <a href="mailto:hello@lunarihub.com" className="hover:text-[#C9A87C]">
            hello@lunarihub.com
          </a>
        </div>
      </div>
    </footer>
  );
}
