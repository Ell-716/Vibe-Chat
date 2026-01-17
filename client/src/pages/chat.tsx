import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ChatSidebar } from "@/components/chat-sidebar";
import { MessageList } from "@/components/message-list";
import { ChatInput } from "@/components/chat-input";
import { EmptyState } from "@/components/empty-state";
import { AgentSelector } from "@/components/agent-selector";
import { AgentSettingsModal } from "@/components/agent-settings-modal";
import { ChannelStatus } from "@/components/channel-status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Menu, Volume2, VolumeX } from "lucide-react";
import type { Conversation, Message, MCPTool, Agent } from "@shared/schema";

interface AIModel {
  id: string;
  name: string;
  provider: string;
}

interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export default function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini");
  const [voiceResponseEnabled, setVoiceResponseEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("voiceResponseEnabled");
    return saved ? JSON.parse(saved) : false;
  });
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const toggleVoiceResponse = () => {
    const newValue = !voiceResponseEnabled;
    setVoiceResponseEnabled(newValue);
    localStorage.setItem("voiceResponseEnabled", JSON.stringify(newValue));
  };

  const { data: models = [] } = useQuery<AIModel[]>({
    queryKey: ["/api/models"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Set default agent when agents load
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      const defaultAgent = agents.find(a => a.isDefault) || agents[0];
      setSelectedAgent(defaultAgent);
    }
  }, [agents, selectedAgent]);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: activeConversation, isLoading: messagesLoading } = useQuery<ConversationWithMessages>({
    queryKey: ["/api/conversations", activeConversationId],
    enabled: activeConversationId !== null,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/conversations", { title });
      return res.json();
    },
    onSuccess: (newConversation: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConversationId(newConversation.id);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create conversation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (activeConversationId === deleteConversationMutation.variables) {
        setActiveConversationId(null);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete conversation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const renameConversationMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      const res = await apiRequest("PATCH", `/api/conversations/${id}`, { title });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConversationId] });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to rename conversation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, streamingMessage, scrollToBottom]);

  const handleNewChat = () => {
    setActiveConversationId(null);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: number) => {
    setActiveConversationId(id);
    setSidebarOpen(false);
  };

  const handleDeleteConversation = (id: number) => {
    deleteConversationMutation.mutate(id);
  };

  const handleRenameConversation = (id: number, title: string) => {
    renameConversationMutation.mutate({ id, title });
  };

  const handleGoHome = () => {
    setActiveConversationId(null);
    setSidebarOpen(false);
  };

  const handleSendMessage = async (content: string, mcpTools?: MCPTool[]) => {
    if (!activeConversationId) {
      const res = await apiRequest("POST", "/api/conversations", { title: content.slice(0, 50) });
      const newConversation = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConversationId(newConversation.id);
      
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations", newConversation.id] });
      await streamMessage(newConversation.id, content, mcpTools);
    } else {
      const currentConversation = activeConversation;
      const isFirstMessage = currentConversation?.messages?.length === 0;
      const isDefaultTitle = currentConversation?.title === "New Chat";
      
      if (isFirstMessage && isDefaultTitle) {
        renameConversationMutation.mutate({ 
          id: activeConversationId, 
          title: content.slice(0, 50) 
        });
      }
      
      await streamMessage(activeConversationId, content, mcpTools);
    }
  };

  const streamMessage = async (conversationId: number, content: string, mcpTools?: MCPTool[]) => {
    setIsStreaming(true);
    setStreamingMessage("");

    queryClient.setQueryData<ConversationWithMessages>(
      ["/api/conversations", conversationId],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...old.messages,
            {
              id: Date.now(),
              conversationId,
              role: "user",
              content,
              createdAt: new Date(),
            },
          ],
        };
      }
    );

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, mcpTools, model: selectedModel, agentId: selectedAgent?.id }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullResponse += data.content;
                setStreamingMessage(fullResponse);
              }
              if (data.done) {
                queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
              }
            } catch (e) {
            }
          }
        }
      }
    } catch (error) {
      console.error("Error streaming message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const messages = activeConversation?.messages || [];
  const showEmptyState = !activeConversationId || (messages.length === 0 && !isStreaming);
  const isLoadingConversation = activeConversationId !== null && messagesLoading;

  return (
    <div className="flex h-screen w-full bg-background">
      <ChatSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onGoHome={handleGoHome}
        isLoading={conversationsLoading}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex h-12 items-center justify-between px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-foreground hover:bg-accent"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-sidebar-toggle"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-3">
            <ChannelStatus />
            
            <div className="w-px h-6 bg-border" />
            
            <AgentSelector
              agents={agents}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              onOpenSettings={() => setAgentSettingsOpen(true)}
            />

            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 ${voiceResponseEnabled ? "text-primary" : "text-muted-foreground"} hover:bg-accent`}
              onClick={toggleVoiceResponse}
              title={voiceResponseEnabled ? "Voice responses enabled" : "Voice responses disabled"}
              data-testid="button-voice-toggle"
            >
              {voiceResponseEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
            
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger 
                className="w-auto gap-2 bg-transparent border-0 text-foreground hover:bg-accent focus:ring-0"
                data-testid="select-model"
              >
                <SelectValue placeholder="Select model">
                  {models.find(m => m.id === selectedModel)?.name || "Select model"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-popover-border">
                {models.map((model) => (
                  <SelectItem 
                    key={model.id} 
                    value={model.id}
                    data-testid={`select-model-${model.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{model.name}</span>
                      <span className="text-xs text-muted-foreground">({model.provider})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <main className="flex-1 overflow-hidden flex flex-col">
          {isLoadingConversation ? (
            <div className="flex-1 px-4 md:px-6 py-6">
              <div className="mx-auto max-w-3xl space-y-6">
                <div className="flex gap-3 justify-end">
                  <Skeleton className="h-12 w-48 rounded-2xl bg-muted" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full bg-muted" />
                  <Skeleton className="h-20 w-72 rounded-2xl bg-muted" />
                </div>
              </div>
            </div>
          ) : showEmptyState ? (
            <EmptyState onSuggestionClick={handleSuggestionClick} />
          ) : (
            <MessageList
              messages={messages}
              streamingMessage={streamingMessage}
              isStreaming={isStreaming}
              messagesEndRef={messagesEndRef}
              voiceResponseEnabled={voiceResponseEnabled}
            />
          )}

          <ChatInput
            onSendMessage={handleSendMessage}
            isStreaming={isStreaming}
          />
        </main>
      </div>

      <AgentSettingsModal
        open={agentSettingsOpen}
        onOpenChange={setAgentSettingsOpen}
        agents={agents}
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
      />
    </div>
  );
}
