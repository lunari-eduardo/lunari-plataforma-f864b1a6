import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PrimaryButton, uiFont } from "./primitives";

export function LunariNav() {
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#F5F1EA]/85 backdrop-blur-xl border-b border-[#0B1B2B]/8"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6 md:px-8">
        <a
          href="/"
          className="text-[20px] font-medium tracking-tight text-[#0B1B2B]"
          style={{ fontFamily: '"Fraunces", serif' }}
        >
          lunari
        </a>

        <div
          className="hidden items-center gap-9 md:flex"
          style={uiFont}
        >
          <a href="#produto" className="text-[14px] text-[#0B1B2B]/70 transition-colors hover:text-[#0B1B2B]">
            Produto
          </a>
          <a href="#ia" className="text-[14px] text-[#0B1B2B]/70 transition-colors hover:text-[#0B1B2B]">
            Assistente
          </a>
          <a href="#planos" className="text-[14px] text-[#0B1B2B]/70 transition-colors hover:text-[#0B1B2B]">
            Planos
          </a>
        </div>

        <PrimaryButton onClick={() => nav("/auth")}>Entrar</PrimaryButton>
      </div>
    </nav>
  );
}
