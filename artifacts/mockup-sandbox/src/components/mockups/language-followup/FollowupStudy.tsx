import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Globe2,
  MessageSquare,
  Plus,
  RefreshCw,
  SendHorizontal,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import "./_group.css";

type StudyIdea = {
  scope: string;
  title: string;
  detail: string;
  prompt: string;
  icon: "chat" | "language";
};

const ideaSets: StudyIdea[][] = [
  [
    {
      scope: "THIS CHAT",
      title: "Try a market conversation",
      detail: "Use “comprar” and “¿cuánto cuesta?” in a quick role-play.",
      prompt:
        "Let's do a short market role-play in Spanish. Help me practice comprar and ¿cuánto cuesta? Give me one turn at a time and correct me gently.",
      icon: "chat",
    },
    {
      scope: "YOUR SPANISH CHATS",
      title: "Practice asking for directions",
      detail: "Bring back useful phrases from your other Spanish lessons.",
      prompt:
        "Let's practice asking for directions in Spanish, building on what I've learned in my other Spanish conversations. Make it a short role-play and help me reuse familiar words.",
      icon: "language",
    },
  ],
  [
    {
      scope: "THIS CHAT",
      title: "Review the words from today",
      detail: "A 3-question mini quiz on the phrases we just used.",
      prompt:
        "Quiz me on the Spanish words and phrases from this chat. Ask three questions one at a time, and wait for my answer.",
      icon: "chat",
    },
    {
      scope: "YOUR SPANISH CHATS",
      title: "Mix in food and travel",
      detail: "Connect topics you've practiced across your Spanish chats.",
      prompt:
        "Create a short Spanish conversation that combines food and travel phrases from my other Spanish chats. Keep it interactive and correct me gently.",
      icon: "language",
    },
  ],
];

function Sidebar() {
  const conversations = [
    "Ordering at the market",
    "Teach me a few greetings",
    "New Spanish chat",
    "A weekend in Madrid",
    "Food and restaurants",
  ];

  return (
    <aside className="hidden h-full w-[272px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="px-6 pb-4 pt-7">
        <div className="text-[21px] font-bold tracking-tight text-primary">
          Language Tutor
        </div>
        <div className="mt-1 text-[12px] font-medium text-muted-foreground">
          Your personal language companion
        </div>
      </div>

      <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-3 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-primary/25 text-xs font-bold text-foreground">
          18
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Spanish <span className="font-normal text-muted-foreground">Español</span></div>
          <div className="text-xs text-muted-foreground">18 of 25 words today</div>
        </div>
      </div>

      <nav className="space-y-1 px-4 py-1">
        <div className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5 text-sm font-semibold text-secondary-foreground">
          <Plus className="h-4 w-4" /> New Conversation
        </div>
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/85">
          <BookOpen className="h-4 w-4" /> Lessons
        </div>
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/85">
          <Settings className="h-4 w-4" /> Settings
        </div>
      </nav>

      <div className="mt-7 px-6 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Conversations
      </div>
      <div className="mt-2 flex-1 space-y-1 overflow-hidden px-3">
        {conversations.map((conversation, index) => (
          <div
            key={conversation}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] ${
              index === 0
                ? "bg-primary/10 font-semibold text-primary"
                : "text-sidebar-foreground/75"
            }`}
          >
            <MessageSquare className="h-4 w-4 shrink-0 opacity-65" />
            <span className="truncate">{conversation}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-sidebar-border px-5 py-4 text-xs text-muted-foreground">
        <span>Theme</span>
        <span>☼　◐　▣</span>
      </div>
    </aside>
  );
}

function TutorMessage({
  user,
  children,
}: {
  user?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex w-full ${user ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[82%] gap-3 ${user ? "flex-row-reverse" : ""}`}>
        <div
          className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
            user
              ? "border-primary bg-primary text-primary-foreground"
              : "border-secondary bg-secondary text-secondary-foreground"
          }`}
        >
          {user ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </div>
        <div
          className={`rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed shadow-sm ${
            user
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm border border-card-border bg-card text-card-foreground"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({
  idea,
  onUse,
  isSelected,
}: {
  idea: StudyIdea;
  onUse: () => void;
  isSelected: boolean;
}) {
  const ScopeIcon = idea.icon === "chat" ? MessageSquare : Globe2;
  return (
    <button
      type="button"
      onClick={onUse}
      className="group flex min-h-[104px] w-full items-start gap-3 rounded-xl border border-border bg-background/80 p-3.5 text-left transition hover:border-primary/35 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Use study suggestion: ${idea.title}`}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <ScopeIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold tracking-[0.12em] text-muted-foreground">
          {idea.scope}
        </span>
        <span className="mt-1 block text-[13px] font-semibold leading-snug text-foreground">
          {idea.title}
        </span>
        <span className="mt-1 block text-[11px] leading-[1.45] text-muted-foreground">
          {idea.detail}
        </span>
      </span>
      <span className="mt-1 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary">
        {isSelected ? (
          <Check className="h-4 w-4 text-secondary" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
      </span>
    </button>
  );
}

export function FollowupStudy() {
  const [input, setInput] = useState("");
  const [ideaSet, setIdeaSet] = useState(0);
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const ideas = ideaSets[ideaSet]!;

  const useIdea = (idea: StudyIdea) => {
    setInput(idea.prompt);
    setSelectedIdea(idea.title);
  };

  return (
    <div className="flex h-screen min-h-[700px] w-full overflow-hidden bg-background font-sans text-foreground">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col bg-background/50">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-hidden px-8 pb-5 pt-8 lg:px-12">
            <TutorMessage>
              ¡Muy bien! You already know how to greet someone. Let's practice
              asking for something at a market.
            </TutorMessage>
            <TutorMessage user>
              How do I ask how much something costs?
            </TutorMessage>
            <TutorMessage>
              <p>
                You can ask{" "}
                <span className="inline-flex items-baseline gap-2 rounded-md bg-primary/10 px-2 py-0.5">
                  <span className="text-[17px] text-primary">¿Cuánto cuesta?</span>
                  <span className="text-xs text-muted-foreground">How much does it cost?</span>
                </span>
                {" "}And to say “I want to buy,” use:
              </p>
              <div className="mt-2 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
                <div className="text-[17px] text-primary">Quiero comprar esto.</div>
                <div className="mt-1 text-xs italic text-foreground/70">KYEH-roh kohm-PRAR EHS-toh</div>
                <div className="mt-1 text-xs text-muted-foreground">I want to buy this.</div>
              </div>
              <p className="mt-2">Try it with me: ask how much this book costs.</p>
            </TutorMessage>
          </div>
        </div>

        <footer className="shrink-0 border-t border-border bg-background/90 px-6 pb-5 pt-3 backdrop-blur-sm lg:px-10">
          <section
            aria-labelledby="study-followup-title"
            className="mx-auto mb-3 max-w-4xl rounded-2xl border border-primary/15 bg-card px-4 py-3.5 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 id="study-followup-title" className="text-[13px] font-bold leading-tight">
                    Keep your Spanish going
                  </h2>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    AI study ideas · This chat + your other Spanish chats
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIdeaSet((current) => (current + 1) % ideaSets.length);
                  setSelectedIdea(null);
                }}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Generate new study ideas"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New ideas</span>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ideas.map((idea) => (
                <SuggestionCard
                  key={idea.scope}
                  idea={idea}
                  isSelected={selectedIdea === idea.title}
                  onUse={() => useIdea(idea)}
                />
              ))}
            </div>
          </section>

          <form
            className="mx-auto flex max-w-4xl items-center gap-2 rounded-2xl border border-card-border bg-card px-2 py-1.5 shadow-sm transition-shadow focus-within:ring-1 focus-within:ring-primary"
            onSubmit={(event) => {
              event.preventDefault();
              setInput("");
              setSelectedIdea(null);
            }}
          >
            <button
              type="button"
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-muted/70 px-2.5 text-xs font-medium text-muted-foreground"
              aria-label="AI model: Auto"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <input
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setSelectedIdea(null);
              }}
              placeholder="Type your message..."
              aria-label="Type your message"
              className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-95 disabled:opacity-50"
              aria-label="Send message"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}