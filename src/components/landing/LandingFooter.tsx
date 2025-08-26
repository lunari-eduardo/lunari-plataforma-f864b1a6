import { Button } from "@/components/ui/button";
import { Shield, Lock, Headphones } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer className="bg-landing-text text-white">
      {/* Selos de confiança */}
      <div className="py-12 border-b border-white/10">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center space-y-3">
              <Shield className="w-8 h-8 text-landing-accent" />
              <h3 className="font-semibold">Backup Automático</h3>
              <p className="text-white/70 text-sm">Seus dados protegidos 24/7</p>
            </div>
            <div className="flex flex-col items-center space-y-3">
              <Lock className="w-8 h-8 text-landing-accent" />
              <h3 className="font-semibold">SSL Certificado</h3>
              <p className="text-white/70 text-sm">Conexão 100% segura</p>
            </div>
            <div className="flex flex-col items-center space-y-3">
              <Headphones className="w-8 h-8 text-landing-accent" />
              <h3 className="font-semibold">Suporte Especializado</h3>
              <p className="text-white/70 text-sm">Para fotógrafos, por fotógrafos</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Final */}
      <div className="py-16 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            30 dias grátis. O máximo que pode acontecer é você se organizar.
          </h2>
          <p className="text-white/70 mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de fotógrafos que já descobriram como é ter um negócio organizado de verdade.
          </p>
          <Button 
            size="lg" 
            className="bg-landing-brand hover:bg-landing-brand/90 text-white px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            👉 COMEÇAR AGORA
          </Button>
        </div>
      </div>

      {/* Links institucionais */}
      <div className="py-8 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex space-x-6 text-sm">
              <a href="#" className="text-white/70 hover:text-white transition-colors">Sobre</a>
              <a href="#" className="text-white/70 hover:text-white transition-colors">Blog</a>
              <a href="#" className="text-white/70 hover:text-white transition-colors">Suporte</a>
              <a href="#" className="text-white/70 hover:text-white transition-colors">Termos</a>
              <a href="#" className="text-white/70 hover:text-white transition-colors">Privacidade</a>
            </div>
            <div className="text-sm text-white/70">
              © 2024 Lunari. Mais fotos, menos planilhas.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}