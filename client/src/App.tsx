import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import ChatPage from "@/pages/chat";
import SupportPage from "@/pages/support";
import NotFound from "@/pages/not-found";
import { MessageSquare, Headphones } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatPage} />
      <Route path="/support" component={SupportPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Navigation() {
  const [location] = useLocation();
  
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between h-14 px-4 gap-4">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button 
              variant={location === "/" ? "secondary" : "ghost"} 
              size="sm"
              data-testid="nav-link-chat"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
          </Link>
          <Link href="/support">
            <Button 
              variant={location === "/support" ? "secondary" : "ghost"} 
              size="sm"
              data-testid="nav-link-support"
            >
              <Headphones className="w-4 h-4 mr-2" />
              Support Workflow
            </Button>
          </Link>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="flex flex-col h-screen">
            <Navigation />
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
