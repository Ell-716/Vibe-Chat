import { Sparkles, MessageSquare, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Login page shown to unauthenticated users.
 * Initiates the Google OAuth flow by navigating to /auth/google.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-sidebar p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#00a896]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-sidebar-foreground">Vibe Chat</span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-sidebar-foreground leading-tight">
              Your AI-powered<br />workspace
            </h1>
            <p className="mt-4 text-sidebar-foreground/60 text-lg">
              Chat with multiple AI models, search your documents, and manage support — all in one place.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: MessageSquare, label: "Chat with GPT-4o, Llama 3, Claude, and Gemini" },
              { icon: FileText, label: "Upload PDFs and ask questions about your documents" },
              { icon: BarChart3, label: "AI-powered customer support dashboard" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sidebar-foreground/70">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-foreground/30">© 2026 Vibe Chat</p>
      </div>

      {/* Right panel — sign in */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#00a896]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold">Vibe Chat</span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold">Welcome back</h2>
            <p className="text-muted-foreground text-sm">
              Sign in with your Google account to continue
            </p>
          </div>

          <Button
            size="lg"
            variant="outline"
            className="w-full gap-3 border-border hover:bg-accent"
            onClick={() => { window.location.href = "/auth/google"; }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            By signing in you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
