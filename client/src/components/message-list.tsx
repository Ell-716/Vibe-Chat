import { useRef, useEffect } from "react";
import { Bot, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TypingIndicator } from "@/components/typing-indicator";
import type { Message } from "@shared/schema";
import { useState } from "react";

interface MessageListProps {
  messages: Message[];
  streamingMessage: string;
  isStreaming: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

function MessageBubble({ message, isStreaming = false }: { message: Message; isStreaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = async (code: string, index: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  const formatContent = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: { type: "text" | "code"; content: string; language?: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
      }
      parts.push({ type: "code", content: match[2], language: match[1] || "text" });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({ type: "text", content: content.slice(lastIndex) });
    }

    if (parts.length === 0) {
      parts.push({ type: "text", content });
    }

    return parts;
  };

  const renderContent = (content: string) => {
    const parts = formatContent(content);
    let codeBlockIndex = 0;

    return parts.map((part, index) => {
      if (part.type === "code") {
        const currentCodeIndex = codeBlockIndex++;
        return (
          <div key={index} className="relative my-3 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-[#0d0d0d] px-4 py-2 text-xs text-[#999999]">
              <span>{part.language}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[#999999] hover:text-white hover:bg-transparent"
                onClick={() => handleCopyCode(part.content, currentCodeIndex)}
                data-testid={`button-copy-code-${currentCodeIndex}`}
              >
                {copiedCodeIndex === currentCodeIndex ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <pre className="bg-[#0d0d0d] px-4 py-3 overflow-x-auto">
              <code className="text-sm font-mono text-[#e6e6e6]">{part.content}</code>
            </pre>
          </div>
        );
      }

      return (
        <span key={index} className="whitespace-pre-wrap">
          {part.content.split("\n").map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </span>
      );
    });
  };

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
      data-testid={`message-${message.id}`}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00c9a7]">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}

      <div
        className={`
          group relative max-w-[85%] rounded-2xl px-4 py-3
          ${isUser 
            ? "bg-[#00c9a7] text-white" 
            : "bg-[#2d2d2d] text-white"
          }
        `}
      >
        <div className="text-[15px] leading-relaxed">
          {renderContent(message.content)}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-[#00c9a7] animate-pulse" />
          )}
        </div>

        {!isUser && !isStreaming && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-10 top-1 h-8 w-8 opacity-0 group-hover:opacity-100 text-[#999999] hover:text-white hover:bg-transparent transition-opacity"
            onClick={handleCopy}
            data-testid="button-copy-message"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

export function MessageList({ messages, streamingMessage, isStreaming, messagesEndRef }: MessageListProps) {
  return (
    <ScrollArea className="flex-1 px-4 md:px-6">
      <div className="mx-auto max-w-3xl py-6 space-y-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isStreaming && streamingMessage && (
          <MessageBubble
            message={{
              id: -1,
              conversationId: 0,
              role: "assistant",
              content: streamingMessage,
              createdAt: new Date(),
            }}
            isStreaming={true}
          />
        )}

        {isStreaming && !streamingMessage && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00c9a7]">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-[#2d2d2d] rounded-2xl px-4 py-3">
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
