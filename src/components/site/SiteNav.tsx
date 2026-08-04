import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import logoSiteAsset from "@/assets/logo-header-v3.png.asset.json";

const GALLERY_LINKS = [
  { to: "/gallery", label: "Visão geral" },
  { to: "/gallery/select", label: "Select" },
  { to: "/gallery/transfer", label: "Transfer" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const loc = useLocation();

  const isHome = loc.pathname === "/";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fecha menus a cada troca de rota
  useEffect(() => {
    setMobileOpen(false);
    setGalleryOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const linkCls = "text-sm font-medium text-site-on-dark/70 hover:text-site-gold transition-colors";

  return (
    <nav
      data-tone="dark"
      className={cn(
        "fixed inset-x-0 top-0 z-[100] transition-all duration-300",
        !isHome || scrolled || mobileOpen
          ? "bg-site-graphite border-b border-site-line-dark py-3 shadow-lg shadow-black/20"
          : "py-5 bg-gradient-to-b from-site-graphite/90 to-transparent"
      )}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 md:px-10">
        <NavLink
          to="/"
          className="flex items-center gap-2"
        >
          <img 
            src={logoSiteAsset.url} 
            alt="Lunari" 
            className="h-6 w-auto object-contain md:h-7" 
          />
        </NavLink>

        <div className="hidden items-center gap-8 md:flex">
          <NavLink to="/studio" className={linkCls}>
            Studio
          </NavLink>

          <div
            className="relative"
            onMouseEnter={() => setGalleryOpen(true)}
            onMouseLeave={() => setGalleryOpen(false)}
          >
            <button
              type="button"
              aria-expanded={galleryOpen}
              aria-haspopup="menu"
              onClick={() => setGalleryOpen((v) => !v)}
              className={cn(linkCls, "flex items-center gap-1")}
            >
              Gallery
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", galleryOpen && "rotate-180")} />
            </button>

            <div
              className={cn(
                "absolute left-1/2 top-full w-52 -translate-x-1/2 pt-4 transition-all",
                galleryOpen ? "visible opacity-100" : "invisible opacity-0"
              )}
            >
              <div className="rounded-xl border border-site-line-dark bg-site-graphiteSoft p-2 shadow-2xl">
                {GALLERY_LINKS.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className="block rounded-lg px-4 py-2 text-sm text-site-on-dark/80 transition-colors hover:bg-white/5 hover:text-site-gold"
                  >
                    {l.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>

          <NavLink to="/precos" className={linkCls}>
            Preços
          </NavLink>
        </div>

        <div className="flex items-center gap-4">
          <NavLink to="/auth" className={cn(linkCls, "hidden sm:inline")}>
            Entrar
          </NavLink>
          <NavLink
            to="/auth"
            className="rounded-full bg-site-gold px-5 py-2.5 text-xs font-bold text-site-graphite transition-all hover:-translate-y-0.5 hover:bg-site-goldPale"
          >
            TESTAR GRÁTIS
          </NavLink>
          <button
            type="button"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="text-site-on-dark md:hidden"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Painel mobile */}
      {mobileOpen && (
        <div className="md:hidden">
          <div className="mt-3 max-h-[calc(100vh-5rem)] overflow-y-auto border-t border-site-line-dark bg-site-graphite px-6 py-6">
            <NavLink to="/studio" className="block py-3 text-base font-medium text-site-on-dark">
              Studio
            </NavLink>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-site-gold">Gallery</p>
            {GALLERY_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className="block py-3 text-base font-medium text-site-on-dark/80">
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/precos" className="mt-4 block py-3 text-base font-medium text-site-on-dark">
              Preços
            </NavLink>
            <NavLink to="/auth" className="mt-4 block py-3 text-base font-medium text-site-gold">
              Entrar
            </NavLink>
          </div>
        </div>
      )}
    </nav>
  );
}
