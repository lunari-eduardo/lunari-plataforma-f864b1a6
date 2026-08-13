import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, ArrowRight } from "lucide-react";

export type UIComponentPayload = {
  type: "table" | "metric_group" | "card_list" | "action" | "confirmation" | "alert";
  [key: string]: any;
};

export function GenerativeUIRenderer({ payload }: { payload: UIComponentPayload }) {
  if (!payload || !payload.type) {
    return <div className="text-destructive text-sm">Payload de UI inválido.</div>;
  }

  switch (payload.type) {
    case "table":
      return <GenerativeTable payload={payload} />;
    case "metric_group":
      return <GenerativeMetricGroup payload={payload} />;
    case "card_list":
      return <GenerativeCardList payload={payload} />;
    case "action":
      return <GenerativeAction payload={payload} />;
    case "confirmation":
      return <GenerativeConfirmation payload={payload} />;
    case "alert":
      return <GenerativeAlert payload={payload} />;
    default:
      return <div className="text-muted-foreground text-sm">Componente visual não suportado: {payload.type}</div>;
  }
}

function GenerativeTable({ payload }: { payload: any }) {
  const { title, columns, rows } = payload;
  if (!columns || !rows) return null;

  return (
    <div className="my-4 w-full overflow-hidden rounded-md border border-border/50 bg-card">
      {title && (
        <div className="border-b border-border/50 bg-muted/20 px-4 py-2 text-sm font-medium text-foreground">
          {title}
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col: string, i: number) => (
                <TableHead key={i} className="whitespace-nowrap text-xs font-semibold">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row: string[], i: number) => (
              <TableRow key={i}>
                {row.map((cell: string, j: number) => (
                  <TableCell key={j} className="whitespace-nowrap text-sm">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function GenerativeMetricGroup({ payload }: { payload: any }) {
  const { title, metrics } = payload;
  if (!metrics || !Array.isArray(metrics)) return null;

  return (
    <div className="my-4 flex flex-col gap-3">
      {title && <h4 className="text-sm font-medium text-foreground">{title}</h4>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map((m: any, i: number) => (
          <Card key={i} className="overflow-hidden bg-card/50">
            <CardContent className="p-3">
              <div className="text-xl font-bold tracking-tight text-foreground">{m.value}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{m.label}</span>
                {m.trend && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {m.trend}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function GenerativeCardList({ payload }: { payload: any }) {
  const { title, items } = payload;
  if (!items || !Array.isArray(items)) return null;

  return (
    <div className="my-4 flex flex-col gap-3">
      {title && <h4 className="text-sm font-medium text-foreground">{title}</h4>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item: any, i: number) => (
          <Card key={i} className="flex flex-col bg-card/50">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              {item.subtitle && <CardDescription className="text-xs">{item.subtitle}</CardDescription>}
            </CardHeader>
            <CardContent className="flex-1 p-3 pt-0">
              {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
            </CardContent>
            {item.action_label && (
              <CardFooter className="p-3 pt-0">
                <Button variant="secondary" size="sm" className="w-full text-xs">
                  {item.action_label}
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function GenerativeAction({ payload }: { payload: any }) {
  return (
    <div className="my-2">
      <Button variant="default" size="sm" className="gap-2">
        {payload.label} <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function GenerativeConfirmation({ payload }: { payload: any }) {
  return (
    <Alert variant="destructive" className="my-4 border-destructive/50 bg-destructive/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="font-semibold">{payload.title || "Atenção"}</AlertTitle>
      <AlertDescription className="mt-2 flex flex-col gap-3">
        <span className="text-sm">{payload.warning_text}</span>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm">{payload.confirm_label || "Confirmar"}</Button>
          <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/20">{payload.cancel_label || "Cancelar"}</Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function GenerativeAlert({ payload }: { payload: any }) {
  const isError = payload.variant === "error";
  const isSuccess = payload.variant === "success";
  const isWarning = payload.variant === "warning";

  return (
    <Alert 
      variant={isError ? "destructive" : "default"} 
      className={`my-3 ${isSuccess ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400" : ""} ${isWarning ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" : ""}`}
    >
      {isError && <AlertCircle className="h-4 w-4" />}
      {isSuccess && <CheckCircle2 className="h-4 w-4" />}
      {isWarning && <AlertTriangle className="h-4 w-4" />}
      {!isError && !isSuccess && !isWarning && <Info className="h-4 w-4" />}
      
      <AlertDescription className="text-sm font-medium">
        {payload.message}
      </AlertDescription>
    </Alert>
  );
}
