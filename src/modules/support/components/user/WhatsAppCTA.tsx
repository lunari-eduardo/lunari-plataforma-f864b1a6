import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { SUPPORT_WHATSAPP_NUMBER } from "../../config";
import { useSupportHost } from "../../SupportHostProvider";

export function WhatsAppCTA() {
  const host = useSupportHost();
  const text = encodeURIComponent(
    `Olá! Sou ${host.currentUser?.name ?? host.currentUser?.email ?? "usuário Lunari"} e preciso de ajuda com o sistema.`
  );
  const href = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${text}`;
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Precisa de ajuda mais rápida?</h3>
        <p className="text-xs text-muted-foreground">
          Fale direto com a equipe pelo WhatsApp em horário comercial.
        </p>
      </div>
      <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
        <a href={href} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="mr-2 h-4 w-4" />
          Conversar pelo WhatsApp
        </a>
      </Button>
    </div>
  );
}
