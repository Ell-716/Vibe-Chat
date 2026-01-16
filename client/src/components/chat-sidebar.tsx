import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Plus, MessageSquare, MoreHorizontal, Pencil, Trash2, X, Check, Sparkles } from "lucide-react";
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
  const groupConversationsByDate = (conversations: Conversation[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const groups: { label: string; conversations: Conversation[] }[] = [
      { label: "Today", conversations: [] },
      { label: "Yesterday", conversations: [] },
      { label: "Previous 7 Days", conversations: [] },
      { label: "Older", conversations: [] },
    ];

    conversations.forEach((conv) => {
      const date = new Date(conv.createdAt);
      if (date >= today) {
        groups[0].conversations.push(conv);
      } else if (date >= yesterday) {
        groups[1].conversations.push(conv);
      } else if (date >= lastWeek) {
        groups[2].conversations.push(conv);
      } else {
        groups[3].conversations.push(conv);
      }
    });

    return groups.filter((g) => g.conversations.length > 0);
  };

  const groups = groupConversationsByDate(conversations);

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
          flex flex-col bg-[#252525]
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        data-testid="sidebar"
      >
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={onGoHome}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            data-testid="button-home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#00c9a7] to-[#00a896]">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">Vibe Chat</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white hover:bg-[#333333]"
            onClick={onClose}
            data-testid="button-close-sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-4 pb-4">
          <Button
            onClick={onNewChat}
            className="w-full bg-[#00c9a7] hover:bg-[#00b398] text-white font-medium"
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
                <Skeleton key={i} className="h-10 w-full bg-[#2d2d2d]" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#999999]">
              No conversations yet
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.label}>
                  <h3 className="px-3 py-2 text-xs font-medium text-[#999999] uppercase tracking-wider">
                    {group.label}
                  </h3>
                  <div className="space-y-1">
                    {group.conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`
                          group relative flex items-center gap-2 rounded-lg px-3 py-2 pr-10 cursor-pointer
                          transition-colors duration-150
                          ${
                            activeConversationId === conversation.id
                              ? "bg-[#2d2d2d]"
                              : "hover:bg-[#2d2d2d]/50"
                          }
                        `}
                        onClick={() => editingId !== conversation.id && onSelectConversation(conversation.id)}
                        data-testid={`conversation-item-${conversation.id}`}
                      >
                        <MessageSquare className="h-4 w-4 text-[#999999] shrink-0" />
                        {editingId === conversation.id ? (
                          <div className="flex-1 flex items-center gap-1">
                            <Input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveRename();
                                if (e.key === "Escape") handleCancelRename();
                              }}
                              className="h-7 text-sm bg-[#1f1f1f] border-[#00c9a7] text-white"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`input-rename-${conversation.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-[#00c9a7] hover:text-[#00c9a7] hover:bg-transparent shrink-0"
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
                              className="h-6 w-6 text-[#999999] hover:text-white hover:bg-transparent shrink-0"
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
                            <span className="truncate text-sm text-white flex-1">
                              {conversation.title}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-[#666666] hover:text-white hover:bg-[#3d3d3d]"
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`button-options-${conversation.id}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-[#2d2d2d] border-[#333333]">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartRename(conversation);
                                  }}
                                  className="text-white hover:bg-[#3d3d3d] cursor-pointer"
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
                                  className="text-red-400 hover:bg-[#3d3d3d] hover:text-red-400 cursor-pointer"
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
      </aside>
    </>
  );
}
