import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, ArrowUpRight } from "lucide-react";
import { PrimaryButton } from "@/components/landing/primitives";

type NavItem = {
  label: string;
  to?: string;
  children?: { label: string; to: string; hint?: string }[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Studio",
    to: "/studio",
  },
  {
    label: "Gallery",
    children: [
      { label: "Visão geral", to: "/gallery", hint: "Select + Transfer" },
      { label: "Gallery Select", to: "/gallery/select", hint: "Cobra extras sozinha" },
      { label: "Gallery Transfer", to: "/gallery/transfer", hint: "Entrega com marca e senha" },
    ],
  },
  { label: "Preços", to: "/precos" },
  { label: "Sobre", to: "/sobre" },
];

export function SiteNav() {
  const nav = useNavigate();
  const loc = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGalleryOpen, setMobileGalleryOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [loc.pathname]);

  // Hero da Home agora é clara — nav sempre com texto escuro.
  const onDark = false;

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || mobileOpen
          ? "bg-[#FAFAF7]/90 backdrop-blur-xl border-b border-[rgba(10,10,10,0.06)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6 md:px-8">
        <NavLink
          to="/"
          className={`flex items-center gap-2 text-[15px] font-medium tracking-tight ${
            onDark ? "text-[#F5F1EA]" : "text-[#0A0A0A]"
          }`}
          style={{ fontFamily: '"Geist", sans-serif', letterSpacing: "-0.02em" }}
        >
          <span
            className="inline-block h-[7px] w-[7px] rounded-full"
            style={
              onDark
                ? { background: "#C9A87C", boxShadow: "0 0 0 3px rgba(201,168,124,0.16)" }
                : { background: "#b0632f", boxShadow: "0 0 0 3px rgba(176,99,47,0.12)" }
            }
          />
          lunari
          <span
            className={`ml-1 text-[10px] font-normal uppercase tracking-[0.18em] ${
              onDark ? "text-[rgba(245,241,234,0.45)]" : "text-[rgba(10,10,10,0.4)]"
            }`}
            style={{ fontFamily: '"Geist Mono", monospace' }}
          >
            hub
          </span>
        </NavLink>


        {/* Desktop */}
        <div
          className="hidden items-center gap-1 md:flex"
          style={{ fontFamily: '"Geist", sans-serif' }}
        >
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => setOpenMenu(item.label)}
                onMouseLeave={() => setOpenMenu(null)}
              >
                <button
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-[13px] ${onDark ? "text-[rgba(245,241,234,0.72)] hover:text-[#F5F1EA]" : "text-[rgba(10,10,10,0.7)] hover:text-[#0A0A0A]"}`}
                  onClick={() => setOpenMenu(openMenu === item.label ? null : item.label)}
                >
                  {item.label}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
                {openMenu === item.label && (
                  <div
                    className="absolute left-0 top-full w-[280px] pt-2"
                    onMouseEnter={() => setOpenMenu(item.label)}
                  >
                    <div className="overflow-hidden rounded-[10px] border border-[rgba(10,10,10,0.08)] bg-[#FAFAF7] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)]">
                      {item.children.map((c) => (
                        <NavLink
                          key={c.to}
                          to={c.to}
                          className={({ isActive }) =>
                            `block px-4 py-3 transition-colors ${
                              isActive
                                ? "bg-[rgba(176,99,47,0.06)]"
                                : "hover:bg-[rgba(10,10,10,0.03)]"
                            }`
                          }
                        >
                          <div className="text-[13px] font-medium text-[#0A0A0A]">{c.label}</div>
                          {c.hint && (
                            <div className="mt-0.5 text-[11px] text-[rgba(10,10,10,0.5)]">
                              {c.hint}
                            </div>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to!}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-[13px] transition-colors ${
                    isActive
                      ? onDark ? "text-[#F5F1EA]" : "text-[#0A0A0A]"
                      : onDark ? "text-[rgba(245,241,234,0.72)] hover:text-[#F5F1EA]" : "text-[rgba(10,10,10,0.7)] hover:text-[#0A0A0A]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ),
          )}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={() => nav("/auth")}
            className={`text-[13px] ${onDark ? "text-[rgba(245,241,234,0.72)] hover:text-[#F5F1EA]" : "text-[rgba(10,10,10,0.7)] hover:text-[#0A0A0A]"}`}
            style={{ fontFamily: '"Geist", sans-serif' }}
          >
            Entrar
          </button>
          <button
            onClick={() => nav("/auth")}
            className="group inline-flex h-10 items-center gap-2 rounded-[8px] px-5 text-[14px] font-medium transition-all duration-300 hover:-translate-y-[1px]"
            style={{
              fontFamily: '"Geist", sans-serif',
              background: onDark ? "#C9A87C" : "#0A0A0A",
              color: onDark ? "#0A0A0A" : "#FAFAF7",
            }}
          >
            Testar grátis
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          className={`md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md ${onDark ? "text-[#F5F1EA]" : "text-[#0A0A0A]"}`}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[rgba(10,10,10,0.06)] bg-[#FAFAF7]">
          <div className="mx-auto max-w-[1200px] px-6 py-4">
            {NAV_ITEMS.map((item) =>
              item.children ? (
                <div key={item.label} className="border-b border-[rgba(10,10,10,0.06)] py-1">
                  <button
                    onClick={() => setMobileGalleryOpen((v) => !v)}
                    className="flex w-full items-center justify-between py-3 text-[14px] text-[#0A0A0A]"
                    style={{ fontFamily: '"Geist", sans-serif' }}
                  >
                    {item.label}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${mobileGalleryOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {mobileGalleryOpen && (
                    <div className="pb-3 pl-3">
                      {item.children.map((c) => (
                        <NavLink
                          key={c.to}
                          to={c.to}
                          className="block py-2 text-[13px] text-[rgba(10,10,10,0.7)]"
                        >
                          {c.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to!}
                  className="block border-b border-[rgba(10,10,10,0.06)] py-3 text-[14px] text-[#0A0A0A]"
                  style={{ fontFamily: '"Geist", sans-serif' }}
                >
                  {item.label}
                </NavLink>
              ),
            )}
            <div className="flex flex-col gap-2 pt-4">
              <button
                onClick={() => nav("/auth")}
                className="h-10 rounded-md border border-[rgba(10,10,10,0.12)] text-[14px] text-[#0A0A0A]"
              >
                Entrar
              </button>
              <PrimaryButton onClick={() => nav("/auth")} className="w-full">
                Testar grátis
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
