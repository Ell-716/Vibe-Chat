import { Bot, Code, PenTool, BarChart, GraduationCap, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Agent } from "@shared/schema";

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent) => void;
  onOpenSettings: () => void;
}

const iconMap: Record<string, typeof Bot> = {
  bot: Bot,
  code: Code,
  "pen-tool": PenTool,
  "bar-chart": BarChart,
  "graduation-cap": GraduationCap,
};

/**
 * Dropdown button for switching the active prompt agent.
 * Shows the selected agent's icon and name; the last item opens the agent settings modal.
 * @param agents - List of available agents to display.
 * @param selectedAgent - The currently active agent (null if none selected).
 * @param onSelectAgent - Called with the chosen Agent when selection changes.
 * @param onOpenSettings - Called when the "Manage Agents" item is clicked.
 */
export function AgentSelector({ agents, selectedAgent, onSelectAgent, onOpenSettings }: AgentSelectorProps) {
  /**
   * Resolves an icon component from the icon name string.
   * Falls back to Bot if the name is not in the map.
   * @param iconName - The icon key from the agent record.
   * @returns The corresponding Lucide icon component.
   */
  const getIcon = (iconName: string) => {
    const Icon = iconMap[iconName] || Bot;
    return Icon;
  };

  const SelectedIcon = selectedAgent ? getIcon(selectedAgent.icon) : Bot;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 bg-transparent border-0 text-foreground hover:bg-accent focus:ring-0 px-3"
          data-testid="button-agent-selector"
        >
          <SelectedIcon className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">{selectedAgent?.name || "Select Agent"}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 bg-popover border-popover-border">
        {agents.map((agent) => {
          const Icon = getIcon(agent.icon);
          return (
            <DropdownMenuItem
              key={agent.id}
              onClick={() => onSelectAgent(agent)}
              className={`group flex items-start gap-3 p-3 cursor-pointer ${
                selectedAgent?.id === agent.id
                  ? "bg-primary/10 text-foreground"
                  : "text-foreground"
              }`}
              data-testid={`agent-option-${agent.id}`}
            >
              <Icon className={`h-5 w-5 mt-0.5 ${selectedAgent?.id === agent.id ? "text-primary" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium group-data-[highlighted]:text-white">{agent.name}</div>
                <div className="text-xs text-muted-foreground truncate group-data-[highlighted]:text-white/75">{agent.description}</div>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onOpenSettings}
          className="flex items-center gap-3 p-3 cursor-pointer"
          data-testid="button-agent-settings"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
          <span>Manage Agents</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
