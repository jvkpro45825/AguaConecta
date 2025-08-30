import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ConvexProvider } from "convex/react";
import { convex } from "@/lib/convex";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { notificationService } from "@/services/notificationService";
import PlatformRouter from "./components/platform/PlatformRouter";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";

const queryClient = new QueryClient();

const App = () => {
  // Initialize PWA for AguaConecta
  useEffect(() => {
    if (notificationService.isSupported()) {
      notificationService.init();
      console.log('🌊 AguaConecta PWA initialized');
    }
  }, []);

  return (
    <ConvexProvider client={convex}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <HashRouter>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/client" element={<PlatformRouter userRole="client" />} />
                  <Route path="/developer" element={<PlatformRouter userRole="developer" />} />
                  <Route path="/platform/*" element={<PlatformRouter />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </HashRouter>
            </TooltipProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ConvexProvider>
  );
};

export default App;