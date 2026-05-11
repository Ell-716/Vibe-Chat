import { Link } from "wouter";
import { LogOut, Settings, HelpCircle, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";

/**
 * Returns up to two uppercase initials from a display name.
 * @param name - Full display name (e.g. "Elena Bai").
 * @returns Initials string (e.g. "EB").
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Sidebar footer widget showing the authenticated user's avatar, name,
 * a dropdown menu (settings, support, help, sign out), and a theme toggle.
 * Avatar falls back to a primary-coloured circle with the user's initials
 * when no Google profile photo is available.
 */
export function UserMenu() {
  const { user } = useAuth();

  /**
   * Posts to /auth/logout to destroy the server session, clears the
   * React Query cache, then does a full-page navigation to / so the
   * auth gate in App.tsx re-evaluates and shows the login screen.
   */
  const handleSignOut = async () => {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Session destruction is best-effort; proceed regardless
    }
    queryClient.clear();
    window.location.href = "/";
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-sidebar-border">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-3 flex-1 justify-start px-2 py-2 h-auto text-sidebar-foreground hover:bg-sidebar-accent min-w-0"
            data-testid="button-user-menu"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {user ? getInitials(user.name) : "?"}
              </div>
            )}
            <span className="text-sm font-medium truncate">
              {user?.name ?? "User"}
            </span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align="start"
          className="w-56 bg-popover border-popover-border"
        >
          {/* Non-clickable header: name + email */}
          {user && (
            <>
              <DropdownMenuLabel className="font-normal py-2">
                <p className="text-sm font-semibold leading-none">{user.name}</p>
                <p className="mt-1 text-xs leading-none text-muted-foreground truncate">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem
            className="cursor-pointer"
            data-testid="menu-item-settings"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </DropdownMenuItem>

          <Link href="/support">
            <DropdownMenuItem
              className="cursor-pointer"
              data-testid="menu-item-support"
            >
              <Headphones className="h-4 w-4 mr-2" />
              Support
            </DropdownMenuItem>
          </Link>

          <DropdownMenuItem
            className="cursor-pointer"
            data-testid="menu-item-help"
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            Help
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={handleSignOut}
            data-testid="menu-item-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ThemeToggle />
    </div>
  );
}
