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
    <div className="p-4">
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-center gap-3 rounded-2xl bg-[#2d2d2d] px-4 py-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start vibing..."
            className="h-[24px] min-h-[24px] max-h-[120px] flex-1 resize-none border-0 bg-transparent text-base text-white placeholder:text-base placeholder:text-[#999999] focus-visible:ring-0 focus-visible:ring-offset-0 leading-[24px] p-0"
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
