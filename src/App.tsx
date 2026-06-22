import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { AuthProvider } from "./contexts/AuthContext";
import ThemeProvider from "./components/theme/ThemeProvider";
import { VisualThemeProvider } from "./contexts/VisualThemeContext";
import { CapabilityRuntimeProvider } from "@/shared/capability";
import { AgendaInvalidationBridge, AgendaRealtimeListener } from "@/modules/agenda";

import { usePricingBootstrap } from "./hooks/usePricingBootstrap";
import { useAppForceUpdate } from "./hooks/useAppForceUpdate";
import { usePWAUpdate } from "./hooks/usePWAUpdate";

import { detectAppContext } from "./lib/appContext";

// Code-split por contexto
const PhotographerApp = React.lazy(() => import("./app-photographer/PhotographerApp"));
const AdminApp = React.lazy(() => import("./app-admin/AdminApp"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ContextFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function App() {
  const { error: pricingError } = usePricingBootstrap();
  usePWAUpdate();
  useAppForceUpdate();

  const context = React.useMemo(() => detectAppContext(), []);

  React.useEffect(() => {
    console.log(
      `🚀 Lunari 2.0 v${import.meta.env.VITE_APP_VERSION || "1.0.0"} - context=${context}`
    );
    if (pricingError) {
      console.warn("⚠️ Pricing system had initialization issues:", pricingError);
    }
  }, [context, pricingError]);

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <VisualThemeProvider>
            <AuthProvider>
              <CapabilityRuntimeProvider>
                <AgendaInvalidationBridge />
                <AgendaRealtimeListener />
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <React.Suspense fallback={<ContextFallback />}>
                    {context === "admin" ? <AdminApp /> : <PhotographerApp />}
                  </React.Suspense>
                </TooltipProvider>
              </CapabilityRuntimeProvider>
            </AuthProvider>
          </VisualThemeProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
