import { Construction } from "lucide-react";

interface Props {
  title: string;
  description?: string;
}

export function ModulePlaceholder({ title, description }: Props) {
  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="rounded-xl border border-dashed border-border/60 bg-card/30 backdrop-blur p-10 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground">
          <Construction className="h-5 w-5" />
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {description || "Módulo reservado. Conteúdo será implementado em etapa futura."}
        </p>
      </div>
    </div>
  );
}
