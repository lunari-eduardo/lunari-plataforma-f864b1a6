import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const COLS = [
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
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Termos de uso", to: "/legal/termos" },
      { label: "Privacidade", to: "/legal/privacidade" },
      { label: "Exclusão de dados", to: "/legal/exclusao-dados" },
      { label: "Segurança", to: "/legal/seguranca" },
      { label: "Cookies", to: "/legal/cookies" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-site-offwhite py-20 border-t border-site-lineLight">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <NavLink to="/" className="text-site-ink text-2xl font-semibold tracking-tight flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-site-gold" />
              lunari<span className="text-site-ink/40 font-mono text-xs uppercase tracking-widest ml-0.5">hub</span>
            </NavLink>
            <p className="mt-6 max-w-xs text-site-inkMuted leading-relaxed">
              O primeiro ecossistema de gestão que pensa como um fotógrafo profissional. 
              Studio e Gallery operando como um só cérebro.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] uppercase tracking-widest font-mono text-site-inkMuted mb-6">{col.title}</h4>
              <ul className="space-y-4">
                {col.links.map((link) => (
                  <li key={link.to}>
                    <NavLink to={link.to} className="text-sm text-site-ink/70 hover:text-site-gold transition-colors">
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-20 pt-8 border-t border-site-lineLight flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-site-inkMuted uppercase tracking-wider">
          <p>© {new Date().getFullYear()} LUNARI HUB • FEITO PARA FOTÓGRAFOS</p>
          <a href="mailto:hello@lunarihub.com" className="hover:text-site-gold transition-colors">hello@lunarihub.com</a>
        </div>
      </div>
    </footer>
  );
}
