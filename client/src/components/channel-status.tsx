import { useQuery } from "@tanstack/react-query";
import { SiDiscord } from "react-icons/si";
import { Globe } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChannelStatus {
  discord: {
    connected: boolean;
    username?: string;
    servers?: number;
  };
  web: {
    connected: boolean;
  };
}

export function ChannelStatus() {
  const { data: status } = useQuery<ChannelStatus>({
    queryKey: ["/api/channels/status"],
    refetchInterval: 30000,
  });

  if (!status) return null;

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/50">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Web</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Web chat active</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${
            status.discord.connected 
              ? 'bg-[#5865F2]/20' 
              : 'bg-secondary/50 opacity-50'
          }`}>
            <SiDiscord className={`w-3.5 h-3.5 ${
              status.discord.connected ? 'text-[#5865F2]' : 'text-muted-foreground'
            }`} />
            <span className="text-xs text-muted-foreground">
              {status.discord.connected ? 'Discord' : 'Offline'}
            </span>
            {status.discord.connected && status.discord.servers !== undefined && (
              <span className="text-xs text-muted-foreground/70">
                ({status.discord.servers})
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {status.discord.connected ? (
            <div className="text-sm">
              <p className="font-medium">{status.discord.username}</p>
              <p className="text-muted-foreground">
                Connected to {status.discord.servers} server{status.discord.servers !== 1 ? 's' : ''}
              </p>
            </div>
          ) : (
            <p>Discord bot not connected</p>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
