import { Link } from "react-router-dom";
import { Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAssistantAccess } from "@/modules/assistant/runtime/useAssistantAccess";

/**
 * Card de conexão MCP da Lu — movido de Integrações para o Hub de IA,
 * onde já vivem tokens, aprovações e atividade do assistente.
 */
export function HubConexoesAssistente() {
  const { allowed } = useAssistantAccess();

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-accent-gold" />
          Assistente Lu · MCP
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-xs text-muted-foreground">
          Conecte assistentes externos (ChatGPT, Claude Desktop, Cursor, n8n) às ferramentas da Lu
          via Model Context Protocol. Cada token é individual, revogável e respeita seu estágio de
          liberação da Lu.
        </p>
        {allowed ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/app/assistente/mcp">Gerenciar tokens MCP</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/assistente/aprovacoes">Aprovações pendentes</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            A Lu ainda não está liberada para sua conta neste estágio. Assim que o rollout avançar,
            esta área mostrará os controles de conexão MCP.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HubConexoesAssistente;
