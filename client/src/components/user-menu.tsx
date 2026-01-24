import { Link } from "wouter";
import { User, LogOut, Settings, HelpCircle, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export function UserMenu() {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-sidebar-border">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-3 flex-1 justify-start px-2 py-2 h-auto text-sidebar-foreground hover:bg-sidebar-accent"
            data-testid="button-user-menu"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <User className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">User</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="w-56 bg-popover border-popover-border"
        >
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
            data-testid="menu-item-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ThemeToggle />
    </div>
  );
}
