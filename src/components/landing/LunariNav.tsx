import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PrimaryButton } from "./primitives";

export function LunariNav() {
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#FAFAF7]/85 backdrop-blur-xl border-b border-[rgba(10,10,10,0.06)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6 md:px-8">
        <a
          href="/"
          className="flex items-center gap-2 text-[15px] font-medium tracking-tight text-[#0A0A0A]"
          style={{ fontFamily: '"Geist", sans-serif', letterSpacing: "-0.02em" }}
        >
          <span
            className="inline-block h-[7px] w-[7px] rounded-full"
            style={{ background: "#FF5A1F", boxShadow: "0 0 0 3px rgba(255,90,31,0.12)" }}
          />
          lunari
          <span className="ml-1 text-[10px] font-normal uppercase tracking-[0.18em] text-[rgba(10,10,10,0.4)]" style={{ fontFamily: '"Geist Mono", monospace' }}>
            v1.4
          </span>
        </a>

        <div
          className="hidden items-center gap-8 md:flex"
          style={{ fontFamily: '"Geist", sans-serif' }}
        >
          {[
            ["Produto", "#produto"],
            ["Assistente", "#ia"],
            ["Planos", "#planos"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-[13px] text-[rgba(10,10,10,0.65)] transition-colors hover:text-[#0A0A0A]"
            >
              {label}
            </a>
          ))}
        </div>

        <PrimaryButton onClick={() => nav("/auth")}>Entrar</PrimaryButton>
      </div>
    </nav>
  );
}
