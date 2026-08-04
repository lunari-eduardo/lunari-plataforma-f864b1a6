import { ReactNode, useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SITE_COLORS } from "./theme";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={cn(
      "fixed inset-x-0 top-0 z-[100] transition-all duration-300",
      scrolled 
        ? "bg-site-graphite/85 backdrop-blur-md border-b border-site-line-dark py-3" 
        : "bg-transparent py-5"
    )}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10 flex items-center justify-between">
        <NavLink to="/" className="text-site-on-dark text-xl font-semibold tracking-tight flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-site-gold shadow-[0_0_12px_rgba(201,168,124,0.4)]" />
          lunari<span className="text-site-on-dark/40 font-mono text-xs uppercase tracking-widest ml-0.5">hub</span>
        </NavLink>

        <div className="hidden md:flex items-center gap-8">
          <NavLink to="/studio" className="text-sm font-medium text-site-on-dark/70 hover:text-site-gold transition-colors">Studio</NavLink>
          <div className="relative group">
            <button className="text-sm font-medium text-site-on-dark/70 hover:text-site-gold transition-colors flex items-center gap-1">
              Gallery
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="bg-site-graphiteSoft border border-site-line-dark rounded-xl p-2 w-48 shadow-2xl">
                <NavLink to="/gallery" className="block px-4 py-2 text-sm text-site-on-dark/80 hover:bg-site-line-dark rounded-lg transition-colors">Visão geral</NavLink>
                <NavLink to="/gallery/select" className="block px-4 py-2 text-sm text-site-on-dark/80 hover:bg-site-line-dark rounded-lg transition-colors">Select</NavLink>
                <NavLink to="/gallery/transfer" className="block px-4 py-2 text-sm text-site-on-dark/80 hover:bg-site-line-dark rounded-lg transition-colors">Transfer</NavLink>
              </div>
            </div>
          </div>
          <NavLink to="/precos" className="text-sm font-medium text-site-on-dark/70 hover:text-site-gold transition-colors">Preços</NavLink>
        </div>

        <div className="flex items-center gap-4">
          <NavLink to="/auth" className="text-sm font-medium text-site-on-dark/70 hover:text-site-gold transition-colors">Entrar</NavLink>
          <NavLink 
            to="/auth" 
            className="bg-site-gold text-site-graphite text-xs font-bold px-5 py-2.5 rounded-full hover:bg-site-goldPale transition-all hover:-translate-y-0.5"
          >
            TESTAR GRÁTIS
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
