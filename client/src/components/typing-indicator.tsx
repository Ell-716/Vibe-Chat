export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1" data-testid="typing-indicator">
      <span
        className="h-2 w-2 rounded-full bg-[#00c9a7] animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="h-2 w-2 rounded-full bg-[#00c9a7] animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="h-2 w-2 rounded-full bg-[#00c9a7] animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}
