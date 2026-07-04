import { useState, useEffect, useRef } from "react";
import { Bot, Copy, Check, Volume2, VolumeX, Loader2 } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TypingIndicator } from "@/components/typing-indicator";
import type { Message } from "@shared/schema";

interface MessageListProps {
  messages: Message[];
  streamingMessage: string;
  isStreaming: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  voiceResponseEnabled?: boolean;
  /** Maps message ID → document name for summary visual treatment and label. */
  summaryMessageIds?: Map<number, string>;
}

let currentAudio: HTMLAudioElement | null = null;

/**
 * Fetches TTS audio for the given text and plays it through the browser.
 * Stops any currently playing audio first to prevent overlap.
 * Revokes the object URL on playback end or error to avoid memory leaks.
 * @param text - The text to synthesise and play.
 */
async function playTextToSpeech(text: string): Promise<void> {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  const response = await fetch("/api/text-to-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate speech");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  
  const audio = new Audio(url);
  currentAudio = audio;
  
  audio.onended = () => {
    currentAudio = null;
    URL.revokeObjectURL(url);
  };
  
  audio.onerror = () => {
    currentAudio = null;
    URL.revokeObjectURL(url);
  };

  await audio.play();
}

/**
 * Splits message content into interleaved text and fenced code-block parts.
 * Extracted outside the component so it is not recreated on every render.
 * @param content - Raw message string possibly containing markdown code blocks.
 * @returns Array of typed content parts ready for rendering.
 */
function formatContent(content: string): { type: "text" | "code"; content: string; language?: string }[] {
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
}

/**
 * Renders a single chat message bubble with copy and TTS speak actions.
 * User messages are right-aligned; assistant messages are left-aligned with a bot avatar.
 * When isStreaming is true, an animated cursor is appended to indicate in-progress generation.
 * When isSummary is true, a "📄 Document Summary" label is shown above the bubble and
 * the bubble uses a wider max-width (85%) to accommodate structured summary content.
 * @param message - The message record to render.
 * @param isStreaming - Whether this bubble is currently being streamed (shows cursor).
 * @param isSummary - Whether this message is a document summary with special styling.
 */
function MessageBubble({ message, isStreaming = false, summaryDocName }: { message: Message; isStreaming?: boolean; summaryDocName?: string }) {
  const isSummary = !!summaryDocName;
  const [copied, setCopied] = useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isUser = message.role === "user";

  /** Copies the full message content to the clipboard and shows a 2-second check icon. */
  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Copies a specific code block to the clipboard and shows a 2-second check icon
   * on the corresponding code block copy button.
   * @param code - The code string to copy.
   * @param index - The zero-based index of the code block within the message.
   */
  const handleCopyCode = async (code: string, index: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  /**
   * Toggles TTS playback for this message bubble.
   * If audio is already playing, pauses it immediately. Otherwise fetches audio from
   * /api/text-to-speech, plays it, and revokes the object URL on completion or error.
   */
  const handleSpeak = async () => {
    if (isPlaying && currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.content }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate speech");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      if (currentAudio) {
        currentAudio.pause();
      }
      
      const audio = new Audio(url);
      currentAudio = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        currentAudio = null;
        URL.revokeObjectURL(url);
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        currentAudio = null;
        URL.revokeObjectURL(url);
      };

      setIsPlaying(true);
      await audio.play();
    } catch (error) {
      console.error("Error playing speech:", error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Renders message content as interleaved text spans and syntax-highlighted code blocks.
   * Summary messages bypass the code-block splitter and use ReactMarkdown directly so that
   * ## headings and bullet points render correctly.
   * codeBlockIndex tracks each code block's position so copy buttons target the right block.
   * @param content - Raw message string.
   * @returns Array of React nodes ready to render inside the message bubble.
   */
  /** Shared markdown components for assistant message text segments. */
  const markdownComponents: Components = {
    h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
    h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-1">{children}</h2>,
    h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
    li: ({ children }) => <li className="text-[15px] leading-relaxed">{children}</li>,
    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    hr: () => <hr className="my-3 border-border" />,
    table: ({ children }) => (
      <div className="overflow-x-auto my-3">
        <table className="border-collapse w-full text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-border px-3 py-1 text-left font-semibold bg-muted">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border border-border px-3 py-1">{children}</td>
    ),
    code: ({ children, className }) => {
      // Inline code only — block code is handled by the pre override below
      if (!className) {
        return <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{children}</code>;
      }
      return <code className="text-sm font-mono text-foreground">{children}</code>;
    },
  };

  const renderContent = (content: string) => {
    // Summary messages contain structured markdown — render with ReactMarkdown
    if (isSummary) {
      return (
        <ReactMarkdown
          disallowedElements={["script", "iframe", "object", "embed"]}
          unwrapDisallowed={true}
          components={{
            h2: ({ children }) => (
              <h2 className="text-base font-bold mt-4 mb-1" style={{ color: "rgb(0,180,216)" }}>
                {children}
              </h2>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
            ),
            li: ({ children }) => <li className="text-[15px] leading-relaxed">{children}</li>,
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          }}
        >
          {content}
        </ReactMarkdown>
      );
    }

    // User messages: plain text, no markdown interpretation
    if (isUser) {
      return (
        <span className="whitespace-pre-wrap">
          {content.split("\n").map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </span>
      );
    }

    // Assistant messages: split at fenced code blocks so code gets the styled
    // block with a copy button; all other text is rendered as markdown.
    const parts = formatContent(content);
    let codeBlockIndex = 0;

    return parts.map((part, index) => {
      if (part.type === "code") {
        const currentCodeIndex = codeBlockIndex++;
        return (
          <div key={index} className="relative my-3 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-muted px-4 py-2 text-xs text-muted-foreground">
              <span>{part.language}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={() => handleCopyCode(part.content, currentCodeIndex)}
                data-testid={`button-copy-code-${currentCodeIndex}`}
              >
                {copiedCodeIndex === currentCodeIndex ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <pre className="bg-muted px-4 py-3 overflow-x-auto">
              <code className="text-sm font-mono text-foreground">{part.content}</code>
            </pre>
          </div>
        );
      }

      // Text segment: render as markdown so headings, bold, lists, tables etc. display correctly.
      // remarkGfm enables GitHub Flavored Markdown: tables, strikethrough, task lists, etc.
      return (
        <ReactMarkdown
          key={index}
          remarkPlugins={[remarkGfm]}
          disallowedElements={["script", "iframe", "object", "embed"]}
          unwrapDisallowed={true}
          components={markdownComponents}
        >
          {part.content}
        </ReactMarkdown>
      );
    });
  };

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
      data-testid={`message-${message.id}`}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
      )}

      {/* Outer column wrapper controls max-width; widens to 85% for summary messages */}
      <div
        className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
        style={{ maxWidth: isSummary ? "85%" : "75%" }}
      >
        {isSummary && summaryDocName && (
          <span
            className="px-2"
            style={{
              color: "rgb(0,180,216)",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              marginBottom: "8px",
              display: "block",
            }}
          >
            {summaryDocName.replace(/\.[^/.]+$/, "").replace(/[_+]/g, " ")} Summary
          </span>
        )}

        <div
          className="group relative text-[15px] leading-relaxed w-full"
          style={isUser ? {
            padding: "12px 16px",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            background: "var(--bubble-user-bg)",
            border: "1px solid var(--bubble-user-border)",
            borderRadius: "18px 18px 4px 18px",
            color: "var(--bubble-user-color)",
          } : {
            padding: "12px 16px",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            background: "var(--bubble-ai-bg)",
            borderLeft: "3px solid var(--bubble-ai-border-color)",
            borderRadius: "18px 18px 18px 4px",
            color: "var(--bubble-ai-color)",
            boxShadow: "var(--bubble-ai-shadow)",
          }}
        >
          <div>
            {renderContent(message.content)}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
            )}
          </div>

          {!isUser && !isStreaming && (
            <div className="absolute -right-20 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={handleSpeak}
                disabled={isLoading}
                data-testid="button-speak-message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPlaying ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={handleCopy}
                data-testid="button-copy-message"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Scrollable list of MessageBubble components plus a streaming-in-progress state.
 * While streaming, renders a live bubble (with cursor) if content has arrived, or
 * a TypingIndicator if the first chunk hasn't appeared yet.
 * Auto-plays TTS for the last assistant message when voiceResponseEnabled is true
 * and streaming has just completed.
 * @param messages - Persisted messages to display.
 * @param streamingMessage - Accumulated text of the in-progress streamed response.
 * @param isStreaming - Whether the AI is currently generating.
 * @param messagesEndRef - Ref attached to the bottom sentinel div for scroll-to-bottom.
 * @param voiceResponseEnabled - Whether to auto-play TTS after each assistant response.
 */
export function MessageList({ messages, streamingMessage, isStreaming, messagesEndRef, voiceResponseEnabled, summaryMessageIds }: MessageListProps) {
  const lastPlayedMessageIdRef = useRef<number | null>(null);
  const wasStreamingRef = useRef(false);

  // Track when streaming ends
  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
    }
  }, [isStreaming]);

  // Play TTS when a new assistant message appears after streaming
  useEffect(() => {
    if (!voiceResponseEnabled || isStreaming) return;
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;
    
    // Only play if we were streaming and this message hasn't been played yet
    if (wasStreamingRef.current && lastMessage.id !== lastPlayedMessageIdRef.current) {
      lastPlayedMessageIdRef.current = lastMessage.id;
      wasStreamingRef.current = false;
      
      playTextToSpeech(lastMessage.content).catch((error) => {
        console.error("Error playing voice response:", error);
      });
    }
  }, [messages, isStreaming, voiceResponseEnabled]);

  return (
    <ScrollArea className="flex-1 px-4 md:px-6">
      <div className="mx-auto max-w-3xl py-6 space-y-6">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            summaryDocName={summaryMessageIds?.get(message.id)}
          />
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="bg-card rounded-2xl px-4 py-3">
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
