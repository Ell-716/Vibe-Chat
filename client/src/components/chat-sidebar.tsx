import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Plus, MessageSquare, MoreHorizontal, Pencil, Trash2, X, Check, Sparkles, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/user-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: number | null;
  onNewChat: () => void;
  onSelectConversation: (id: number) => void;
  onDeleteConversation: (id: number) => void;
  onRenameConversation: (id: number, title: string) => void;
  onGoHome: () => void;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onGoHome,
  isLoading,
  isOpen,
  onClose,
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [docsExpanded, setDocsExpanded] = useState(false);

  const { data: documents = [] } = useQuery<{ id: string; name: string; totalPages: number; chunkCount: number; uploadedAt: string }[]>({
    queryKey: ["/api/documents"],
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });

  const handleStartRename = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const handleSaveRename = () => {
    if (editingId && editingTitle.trim()) {
      onRenameConversation(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditingTitle("");
  };
  const groups = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const buckets: { label: string; conversations: Conversation[] }[] = [
      { label: "Today", conversations: [] },
      { label: "Yesterday", conversations: [] },
      { label: "Previous 7 Days", conversations: [] },
      { label: "Older", conversations: [] },
    ];

    conversations.forEach((conv) => {
      const date = new Date(conv.createdAt);
      if (date >= today) {
        buckets[0].conversations.push(conv);
      } else if (date >= yesterday) {
        buckets[1].conversations.push(conv);
      } else if (date >= lastWeek) {
        buckets[2].conversations.push(conv);
      } else {
        buckets[3].conversations.push(conv);
      }
    });

    return buckets.filter((g) => g.conversations.length > 0);
  }, [conversations]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}

      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 w-[260px] 
          flex flex-col bg-sidebar
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        data-testid="sidebar"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-8">
          <button
            onClick={onGoHome}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            data-testid="button-home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[#00a896]">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-sidebar-foreground">Vibe Chat</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onClose}
            data-testid="button-close-sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-4 pb-4">
          <Button
            onClick={onNewChat}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            data-testid="button-new-chat"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1 px-2 py-4">
          {isLoading ? (
            <div className="space-y-2 px-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-sidebar-accent" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No conversations yet
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.label}>
                  <h3 className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </h3>
                  <div className="space-y-1">
                    {group.conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`
                          group grid grid-cols-[16px_1fr_24px] items-center gap-2 rounded-lg px-3 py-2 cursor-pointer
                          transition-colors duration-150
                          ${
                            activeConversationId === conversation.id
                              ? "bg-sidebar-accent"
                              : "hover:bg-sidebar-accent/50"
                          }
                        `}
                        onClick={() => editingId !== conversation.id && onSelectConversation(conversation.id)}
                        data-testid={`conversation-item-${conversation.id}`}
                      >
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        {editingId === conversation.id ? (
                          <div className="flex-1 flex items-center gap-1">
                            <Input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveRename();
                                if (e.key === "Escape") handleCancelRename();
                              }}
                              className="h-7 text-sm bg-background border-primary text-foreground"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`input-rename-${conversation.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-primary hover:text-primary hover:bg-transparent shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveRename();
                              }}
                              data-testid={`button-save-rename-${conversation.id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-transparent shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelRename();
                              }}
                              data-testid={`button-cancel-rename-${conversation.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="truncate text-sm text-sidebar-foreground">
                              {conversation.title}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`button-options-${conversation.id}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover border-popover-border">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartRename(conversation);
                                  }}
                                  className="cursor-pointer"
                                  data-testid={`button-rename-${conversation.id}`}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteConversation(conversation.id);
                                  }}
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                  data-testid={`button-delete-${conversation.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {documents.length > 0 && (
          <div className="border-t border-sidebar-border px-2 py-2">
            <Button
              variant="ghost"
              onClick={() => setDocsExpanded(!docsExpanded)}
              className="flex w-full items-center justify-start gap-2 px-2 text-muted-foreground"
              data-testid="button-toggle-documents"
            >
              {docsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">Documents ({documents.length})</span>
            </Button>
            {docsExpanded && (
              <div className="mt-1 space-y-0.5">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 group"
                    data-testid={`document-item-${doc.id}`}
                  >
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate text-xs text-sidebar-foreground flex-1">{doc.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteDocMutation.mutate(doc.id)}
                      className="invisible group-hover:visible shrink-0"
                      data-testid={`button-delete-doc-${doc.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <UserMenu />
      </aside>
    </>
  );
}
