import { useState, KeyboardEvent } from "react";
import { Send, Plus, FileSpreadsheet, FolderOpen, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MCPTool } from "@shared/schema";

interface ChatInputProps {
  onSendMessage: (content: string, mcpTools?: MCPTool[]) => void;
  isStreaming: boolean;
}

export function ChatInput({ onSendMessage, isStreaming }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [mcpToolsOpen, setMcpToolsOpen] = useState(false);
  const [selectedTools, setSelectedTools] = useState<MCPTool[]>([]);

  const handleSend = () => {
    if (message.trim() && !isStreaming) {
      onSendMessage(message.trim(), selectedTools.length > 0 ? selectedTools : undefined);
      setMessage("");
      setSelectedTools([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectTool = (tool: Omit<MCPTool, 'id'>) => {
    const alreadySelected = selectedTools.some(t => t.type === tool.type);
    if (alreadySelected) {
      setMcpToolsOpen(false);
      return;
    }
    const newTool: MCPTool = {
      ...tool,
      id: `${tool.type}-${Date.now()}`,
    };
    setSelectedTools([...selectedTools, newTool]);
    setMcpToolsOpen(false);
  };

  const handleRemoveTool = (toolId: string) => {
    setSelectedTools(selectedTools.filter(t => t.id !== toolId));
  };

  return (
    <div className="p-4">
      <div className="mx-auto max-w-3xl">
        {selectedTools.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedTools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center gap-2 rounded-lg bg-[#2d2d2d] px-3 py-1.5 text-sm text-white"
              >
                {tool.type === 'drive' ? (
                  <FolderOpen className="h-4 w-4 text-[#00c9a7]" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-[#00c9a7]" />
                )}
                <span>{tool.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTool(tool.id)}
                  className="text-[#999999] hover:text-white"
                  data-testid={`button-remove-tool-${tool.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative flex items-center gap-2 rounded-2xl bg-[#2d2d2d] px-3 py-3">
          <Popover open={mcpToolsOpen} onOpenChange={setMcpToolsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="shrink-0 p-1 text-[#999999] hover:text-[#00c9a7] transition-colors"
                data-testid="button-mcp-tools"
              >
                <Plus className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 bg-[#2d2d2d] border-[#444444] p-0"
            >
              <div className="p-2">
                <p className="px-2 py-1.5 text-xs font-medium text-[#999999] uppercase tracking-wider">
                  MCP Tools
                </p>
                <button
                  type="button"
                  onClick={() => handleSelectTool({ name: 'Google Drive', type: 'drive' })}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-white hover:bg-[#3d3d3d] transition-colors"
                  data-testid="button-google-drive"
                >
                  <FolderOpen className="h-5 w-5 text-[#00c9a7]" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Google Drive</p>
                    <p className="text-xs text-[#999999]">Browse and select files</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTool({ name: 'Google Sheets', type: 'sheets' })}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-white hover:bg-[#3d3d3d] transition-colors"
                  data-testid="button-google-sheets"
                >
                  <FileSpreadsheet className="h-5 w-5 text-[#00c9a7]" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Google Sheets</p>
                    <p className="text-xs text-[#999999]">Read or add rows to spreadsheets</p>
                  </div>
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start vibing..."
            className="flex-1 bg-transparent text-base text-white placeholder:text-base placeholder:text-[#999999] focus:outline-none border-0"
            disabled={isStreaming}
            data-testid="input-message"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!message.trim() || isStreaming}
            className={`
              shrink-0 p-1
              ${message.trim() && !isStreaming 
                ? "text-[#00c9a7] hover:text-[#00b398]" 
                : "text-[#666666] cursor-not-allowed"
              }
            `}
            data-testid="button-send"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-[#666666]">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
