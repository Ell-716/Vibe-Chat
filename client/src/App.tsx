import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import ChatPage from "@/pages/chat";
import SupportPage from "@/pages/support";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";

/**
 * Wouter-based client-side router.
 * Checks auth state first — shows a login page when unauthenticated,
 * a blank screen while loading, then routes normally once authenticated.
 */
function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <LoginPage />;

  return (
    <Switch>
      <Route path="/" component={ChatPage} />
      <Route path="/support" component={SupportPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Root application component.
 * Wraps the app in ThemeProvider, QueryClientProvider, and TooltipProvider,
 * then renders the Router inside a full-screen flex layout.
 */
function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="flex flex-col h-screen">
            <main className="flex-1 overflow-hidden">
              <Router />
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
