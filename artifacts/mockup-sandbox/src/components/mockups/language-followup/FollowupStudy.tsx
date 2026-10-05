import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
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
  id: string;
  title: string;
  detail: string;
  prompt: string;
};

// Change this one value to tune when returning learners start seeing review.
const LEARNED_WORD_REVISION_THRESHOLD = 50;
const DEMO_LEARNED_WORDS = 74;

const returningIdeaSets: StudyIdea[][] = [
  [
    {
      id: "continue-market",
      title: "Keep the market role-play going",
      detail: "Buy fruit and ask the price in Spanish.",
      prompt:
        "Let's continue our Spanish market role-play. Help me buy fruit and ask the price, one turn at a time.",
    },
    {
      id: "revision",
      title: "Review familiar Spanish words",
      detail: "A quick quiz from words you've already learned.",
      prompt:
        "Give me a quick Spanish review quiz using words I've learned before. Ask one at a time and wait for my answer.",
    },
    {
      id: "playful",
      title: "Tell me a silly churro story",
      detail: "A playful Spanish story, then three tiny questions.",
      prompt:
        "Tell me a friendly, silly three-line story in Spanish about a runaway churro, then ask me three simple questions about it. Keep the humor kind and non-offensive.",
    },
  ],
  [
    {
      id: "continue-weekend",
      title: "Talk about your weekend",
      detail: "Use today's phrases in a new little scene.",
      prompt:
        "Let's practice talking about my weekend in Spanish using phrases from this chat. Ask me one question at a time and gently correct me.",
    },
    {
      id: "revision",
      title: "Bring back words you know",
      detail: "Practice familiar Spanish with a quick quiz.",
      prompt:
        "Give me a short Spanish review using words I've learned before. Ask one question at a time and wait for my answer.",
    },
    {
      id: "playful",
      title: "Make a tiny taco adventure",
      detail: "A friendly Spanish story with a funny twist.",
      prompt:
        "Make up a friendly, silly three-line story in Spanish about a taco going on an adventure, then ask me three simple questions. Keep the humor kind and non-offensive.",
    },
  ],
];

const newLanguageIdeaSets: StudyIdea[][] = [
  [
    {
      id: "introduce-yourself",
      title: "Introduce yourself in French",
      detail: "Learn a few useful first phrases.",
      prompt:
        "Teach me how to introduce myself in French. Give me one short phrase at a time and help me practice.",
    },
    {
      id: "order-coffee",
      title: "Role-play ordering a coffee",
      detail: "Start with simple words and build from there.",
      prompt:
        "Let's do a beginner French role-play ordering a coffee. Teach me what to say one step at a time.",
    },
    {
      id: "funny-croissant",
      title: "Tell me a silly croissant story",
      detail: "A playful French story, then three tiny questions.",
      prompt:
        "Tell me a friendly, silly three-line story in French about a runaway croissant, then ask me three simple questions about it. Keep the humor kind and non-offensive.",
    },
  ],
  [
    {
      id: "greetings",
      title: "Practice a first greeting",
      detail: "Try a friendly hello and introduction.",
      prompt:
        "Help me practice a simple greeting and introduction in French. Keep it beginner-friendly and interactive.",
    },
    {
      id: "counting",
      title: "Learn numbers for a café",
      detail: "Practice a few useful numbers in context.",
      prompt:
        "Teach me a few French numbers I could use in a café. Ask me to use them in a short example.",
    },
    {
      id: "funny-baguette",
      title: "Give me a baguette challenge",
      detail: "A light, friendly French word game.",
      prompt:
        "Give me a friendly, silly beginner French word challenge about a baguette going on an adventure. Keep it kind and non-offensive.",
    },
  ],
];

function Sidebar({ language = "Spanish" }: { language?: "French" | "Spanish" }) {
  const french = language === "French";
  const conversations = french
    ? [
        "Start learning French",
        "New French chat",
        "A first café visit",
        "Hello in French",
        "French practice",
      ]
    : [
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
          <div className="truncate text-sm font-semibold">
            {french ? "French" : "Spanish"}{" "}
            <span className="font-normal text-muted-foreground">
              {french ? "Français" : "Español"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {french ? "Start with your first 25 words" : "18 of 25 words today"}
          </div>
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
}: {
  idea: StudyIdea;
  onUse: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onUse}
      className="group flex h-[66px] w-[320px] shrink-0 items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-left shadow-sm transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:w-full"
      aria-label={`Choose: ${idea.title}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold leading-4 text-foreground">
          {idea.title}
        </span>
        <span className="mt-0.5 block truncate text-[10px] leading-4 text-muted-foreground">
          {idea.detail}
        </span>
      </span>
      <span className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5">
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

export function FollowupStudy({
  mode = "returning",
}: {
  mode?: "new" | "returning";
}) {
  const [input, setInput] = useState("");
  const [ideaSet, setIdeaSet] = useState(0);
  const french = mode === "new";
  const ideaSets = french ? newLanguageIdeaSets : returningIdeaSets;
  const rawIdeas = ideaSets[ideaSet]!;
  const ideas =
    !french && DEMO_LEARNED_WORDS > LEARNED_WORD_REVISION_THRESHOLD
      ? rawIdeas
      : rawIdeas.filter((idea) => idea.id !== "revision");
  const language = french ? "French" : "Spanish";

  const useIdea = (idea: StudyIdea) => {
    setInput(idea.prompt);
  };

  return (
    <div className="flex h-screen min-h-[700px] w-full overflow-hidden bg-background font-sans text-foreground">
      <Sidebar language={language} />
      <main className="relative flex min-w-0 flex-1 flex-col bg-background/50">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-hidden px-8 pb-5 pt-8 lg:px-12">
            {french ? (
              <>
                <TutorMessage>
                  Bonjour! Let's start with a simple way to introduce yourself.
                </TutorMessage>
                <TutorMessage user>How do I say “my name is Maya”?</TutorMessage>
                <TutorMessage>
                  <p>
                    You can say{" "}
                    <span className="inline-flex items-baseline gap-2 rounded-md bg-primary/10 px-2 py-0.5">
                      <span className="text-[17px] text-primary">Je m’appelle Maya.</span>
                      <span className="text-xs text-muted-foreground">My name is Maya.</span>
                    </span>
                  </p>
                  <p className="mt-2">Try saying it back to me.</p>
                </TutorMessage>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

        <footer className="shrink-0 border-t border-border bg-background/90 px-6 pb-5 pt-3 backdrop-blur-sm lg:px-10">
          <section
            aria-labelledby="study-followup-title"
            className="mx-auto mb-2 max-w-4xl rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 id="study-followup-title" className="text-[12px] font-bold leading-tight">
                    What would you like to practice?
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIdeaSet((current) => (current + 1) % ideaSets.length);
                }}
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Generate new study ideas"
              >
                <RefreshCw className="h-3 w-3" />
                <span className="hidden sm:inline">New ideas</span>
              </button>
            </div>
            <div className="study-idea-rail flex w-full gap-2 overflow-x-auto overflow-y-hidden pb-1 scroll-smooth max-sm:max-h-[150px] max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-y-auto">
              {ideas.map((idea) => (
                <SuggestionCard
                  key={idea.id}
                  idea={idea}
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
              onChange={(event) => setInput(event.target.value)}
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