import { Sparkles, Code, BookOpen, Lightbulb } from "lucide-react";

interface EmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

const suggestions = [
  {
    icon: Code,
    title: "Write code",
    description: "Help me write a function that...",
    prompt: "Help me write a TypeScript function that validates email addresses",
  },
  {
    icon: Lightbulb,
    title: "Brainstorm ideas",
    description: "Generate creative concepts for...",
    prompt: "Generate 5 creative app ideas for improving productivity",
  },
  {
    icon: BookOpen,
    title: "Explain concepts",
    description: "Explain how something works...",
    prompt: "Explain how async/await works in JavaScript in simple terms",
  },
  {
    icon: Sparkles,
    title: "Creative writing",
    description: "Write a story, poem, or article...",
    prompt: "Write a short, engaging product description for a smart home device",
  },
];

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#00c9a7]/20">
          <Sparkles className="h-8 w-8 text-[#00c9a7]" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">How can I help you today?</h2>
        <p className="text-[#999999] max-w-md">
          Start a conversation with me. I can help you write code, answer questions, brainstorm ideas, and much more.
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map((suggestion, index) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={index}
              onClick={() => onSuggestionClick(suggestion.prompt)}
              className="group flex flex-col items-start gap-2 rounded-lg bg-[#2d2d2d] p-4 text-left transition-all duration-150 hover:bg-[#363636] hover:ring-1 hover:ring-[#00c9a7]/50"
              data-testid={`suggestion-${index}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-[#00c9a7]" />
                <span className="font-medium text-white">{suggestion.title}</span>
              </div>
              <span className="text-sm text-[#999999]">{suggestion.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
