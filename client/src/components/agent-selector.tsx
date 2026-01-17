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

export function AgentSelector({ agents, selectedAgent, onSelectAgent, onOpenSettings }: AgentSelectorProps) {
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
          className="h-9 gap-2 bg-transparent border-0 text-white hover:bg-[#333333] focus:ring-0 px-3"
          data-testid="button-agent-selector"
        >
          <SelectedIcon className="h-4 w-4 text-[#00c9a7]" />
          <span className="hidden sm:inline">{selectedAgent?.name || "Select Agent"}</span>
          <ChevronDown className="h-4 w-4 text-[#666666]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 bg-[#2d2d2d] border-[#404040]">
        {agents.map((agent) => {
          const Icon = getIcon(agent.icon);
          return (
            <DropdownMenuItem
              key={agent.id}
              onClick={() => onSelectAgent(agent)}
              className={`flex items-start gap-3 p-3 cursor-pointer ${
                selectedAgent?.id === agent.id
                  ? "bg-[#00c9a7]/10 text-white"
                  : "text-white hover:bg-[#404040]"
              }`}
              data-testid={`agent-option-${agent.id}`}
            >
              <Icon className={`h-5 w-5 mt-0.5 ${selectedAgent?.id === agent.id ? "text-[#00c9a7]" : "text-[#999999]"}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{agent.name}</div>
                <div className="text-xs text-[#999999] truncate">{agent.description}</div>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="bg-[#404040]" />
        <DropdownMenuItem
          onClick={onOpenSettings}
          className="flex items-center gap-3 p-3 text-white hover:bg-[#404040] cursor-pointer"
          data-testid="button-agent-settings"
        >
          <Settings className="h-5 w-5 text-[#999999]" />
          <span>Manage Agents</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
