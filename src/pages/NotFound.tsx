
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-violet-600 mb-4">404</h1>
        <p className="text-xl font-medium mb-6">Página não encontrada</p>
        <p className="text-muted-foreground mb-8">
          Parece que você está tentando acessar uma página que não existe ou foi movida.
        </p>
        <Link to="/app">
          <Button className="bg-violet-600 hover:bg-violet-700">
            Voltar ao início
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
