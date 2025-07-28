
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Index from "./pages/Index";
import Agenda from "./pages/Agenda";
import Clientes from "./pages/Clientes";
import Orcamentos from "./pages/Orcamentos";
import NovaFinancas from "./pages/NovaFinancas";
import Precificacao from "./pages/Precificacao";
import Configuracoes from "./pages/Configuracoes";
import Workflow from "./pages/Workflow";
import NotFound from "./pages/NotFound";
import { AppProvider, AppContext } from "./contexts/AppContext";
import { useIntegration } from "./hooks/useIntegration";
import { useContext } from "react";

// Create a new QueryClient instance outside of the component
const queryClient = new QueryClient();

// Component to initialize integration hooks
function AppIntegration() {
  const context = useAppContext();
  
  // Only initialize integration if context is ready and has data
  const isReady = context && 
    context.orcamentos !== undefined && 
    context.appointments !== undefined;
  
  if (isReady) {
    useIntegration();
  }
  
  return null;
}

// Hook export for accessing context
function useAppContext() {
  try {
    const context = useContext(AppContext);
    return context;
  } catch (error) {
    console.warn('AppContext not available yet:', error);
    return null;
  }
}

// Define App as a proper function component to ensure React hooks work correctly
function App() {
  
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <TooltipProvider>
            <AppIntegration />
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route path="/" element={<Index />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/orcamentos" element={<Orcamentos />} />
                <Route path="/financas" element={<NovaFinancas />} />
                <Route path="/precificacao" element={<Precificacao />} />
                <Route path="/workflow" element={<Workflow />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </TooltipProvider>
        </AppProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
