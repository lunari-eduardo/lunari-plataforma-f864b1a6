import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import type { TechnicalSnapshot } from "../../types";

const LABELS: Record<keyof TechnicalSnapshot, string> = {
  plan: "Plano",
  app_version: "Versão",
  origin_path: "Origem",
  user_agent: "User Agent",
  os: "Sistema",
  browser: "Navegador",
  locale: "Idioma",
  viewport: "Viewport",
  timezone: "Fuso",
};

export function TechnicalSnapshotPanel({ snapshot }: { snapshot: TechnicalSnapshot }) {
  const entries = Object.entries(snapshot).filter(([, v]) => v != null && v !== "");
  return (
    <Card>
      <Collapsible defaultOpen>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer">
            <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
              Snapshot técnico
              <ChevronDown className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <dl className="space-y-1.5 text-xs">
              {entries.length === 0 && (
                <span className="text-muted-foreground">Sem dados.</span>
              )}
              {entries.map(([k, v]) => (
                <div key={k} className="flex items-start gap-2">
                  <dt className="w-20 shrink-0 text-muted-foreground">
                    {LABELS[k as keyof TechnicalSnapshot] ?? k}
                  </dt>
                  <dd className="break-all text-foreground">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
