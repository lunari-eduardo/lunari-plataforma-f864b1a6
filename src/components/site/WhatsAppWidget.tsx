import { MessageCircle } from "lucide-react";
import { uiFont } from "./primitives";

export function WhatsAppWidget() {
  const phoneNumber = "5551998287948";
  const message = encodeURIComponent("Olá! Estava navegando no site e gostaria de tirar uma dúvida.");
  const url = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-[100] group flex items-center gap-3"
    >
      <div 
        className="hidden md:flex items-center px-4 py-2.5 rounded-full bg-site-graphite border border-site-line-dark text-site-on-dark text-xs font-bold uppercase tracking-widest opacity-0 -translate-x-4 pointer-events-none transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0"
        style={uiFont}
      >
        Dúvidas? Fale conosco
      </div>
      
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-site-gold shadow-[0_10px_30px_-5px_rgba(201,168,124,0.5)] transition-all duration-300 hover:scale-110 hover:bg-site-goldPale active:scale-95">
        <MessageCircle className="h-7 w-7 text-site-graphite" fill="currentColor" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-site-gold opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-site-goldPale border border-site-gold"></span>
        </span>
      </div>
    </a>
  );
}
