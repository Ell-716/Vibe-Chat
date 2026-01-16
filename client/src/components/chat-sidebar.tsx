import { formatDistanceToNow } from "date-fns";
import { Plus, MessageSquare, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Conversation } from "@shared/schema";

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: number | null;
  onNewChat: () => void;
  onSelectConversation: (id: number) => void;
  onDeleteConversation: (id: number) => void;
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
  isLoading,
  isOpen,
  onClose,
}: ChatSidebarProps) {
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
          flex flex-col bg-[#1a1a1a] border-r border-[#333333]
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        data-testid="sidebar"
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-[#333333]">
          <Button
            onClick={onNewChat}
            className="flex-1 mr-2 bg-[#00c9a7] hover:bg-[#00b398] text-white font-medium"
            data-testid="button-new-chat"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white"
            onClick={onClose}
            data-testid="button-close-sidebar"
          >
            <X className="h-5 w-5" />
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
                          group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer
                          transition-colors duration-150
                          ${
                            activeConversationId === conversation.id
                              ? "bg-[#2d2d2d]"
                              : "hover:bg-[#2d2d2d]/50"
                          }
                        `}
                        onClick={() => onSelectConversation(conversation.id)}
                        data-testid={`conversation-item-${conversation.id}`}
                      >
                        <MessageSquare className="h-4 w-4 text-[#999999] shrink-0" />
                        <span className="flex-1 truncate text-sm text-white">
                          {conversation.title}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-[#999999] hover:text-red-400 hover:bg-transparent shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conversation.id);
                          }}
                          data-testid={`button-delete-conversation-${conversation.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
