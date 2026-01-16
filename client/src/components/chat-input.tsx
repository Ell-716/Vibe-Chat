import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isStreaming: boolean;
}

export function ChatInput({ onSendMessage, isStreaming }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const maxHeight = 5 * 24;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !isStreaming) {
      onSendMessage(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-[#333333] p-4">
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-end gap-2 rounded-xl bg-[#2d2d2d] p-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message AI..."
            className="min-h-[44px] max-h-[120px] flex-1 resize-none border-0 bg-transparent text-[15px] text-white placeholder:text-[#999999] focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={isStreaming}
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || isStreaming}
            className={`
              h-10 w-10 rounded-full shrink-0
              ${message.trim() && !isStreaming 
                ? "bg-[#00c9a7] hover:bg-[#00b398] text-white" 
                : "bg-[#444444] text-[#999999] cursor-not-allowed"
              }
            `}
            size="icon"
            data-testid="button-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-[#666666]">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
