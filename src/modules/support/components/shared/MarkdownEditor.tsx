import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  minLength,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  minLength?: number;
  maxLength?: number;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  return (
    <div className="space-y-2">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="h-8">
          <TabsTrigger value="edit" className="text-xs">
            Editar
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs">
            Pré-visualizar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="mt-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            minLength={minLength}
            maxLength={maxLength}
            className="resize-y"
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-2">
          <div className="min-h-[6rem] rounded-md border border-border bg-muted/30 p-3">
            {value.trim() ? (
              <MarkdownRenderer source={value} />
            ) : (
              <span className="text-xs text-muted-foreground">Nada para pré-visualizar.</span>
            )}
          </div>
        </TabsContent>
      </Tabs>
      {maxLength && (
        <div className="text-right text-[10px] text-muted-foreground">
          {value.length}/{maxLength}
        </div>
      )}
    </div>
  );
}
