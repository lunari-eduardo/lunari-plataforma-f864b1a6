import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAccessControl } from "@/hooks/useAccessControl";
import NotFound from "@/pages/NotFound";

/**
 * Guard de rotas restritas à equipe Lunari (admin).
 *
 * Para usuário comum a rota se comporta como inexistente — evita revelar
 * recursos internos que ainda não fazem parte do produto do fotógrafo.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { accessState } = useAccessControl();

  if (accessState.status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!accessState.isAdmin) return <NotFound />;

  return <>{children}</>;
}

export default RequireAdmin;
