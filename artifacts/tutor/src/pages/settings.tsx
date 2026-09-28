import { LANGUAGES, LEVELS } from "@workspace/languages";
import { useLanguage } from "@/hooks/use-language";
import { AUTO_MODEL } from "@/lib/model-preference";
import { useModelPreference } from "@/hooks/use-model-preference";
import { ModelSelect, useModelList } from "@/components/model-select";
import { LanguageSelect } from "@/components/language-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/hooks/use-theme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SettingsPage() {
  const { code, setCode, level, setLevel, levelDef } = useLanguage();
  const { mode, resolved } = useTheme();

  const activeLanguage = LANGUAGES.find((l) => l.code === code);

  // Shared with the picker in the chat bar: changing the model in either
  // place updates both, and neither one starts a new conversation.
  const [model, chooseModel] = useModelPreference();
  const {
    models,
    selected,
    autoOrder,
    locked,
    isLoading: isLoadingModels,
    // A previously picked model that upstream has since retired is no longer
    // in the list; say so rather than showing an empty select.
    missing: selectionMissing,
  } = useModelList(model);
  // The picker is ordered by provider name, so the first tested entry is not
  // the first one the server tries — name the head of the real chain instead.
  const firstAutoModel = models.find((m) => m.id === autoOrder[0]);

  const formatContext = (tokens?: number) =>
    tokens ? `${Math.round(tokens / 1000)}K context` : undefined;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-xl mx-auto space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose what you're learning and how deep you want to go. These apply
            to new conversations.
          </p>
        </header>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-foreground">
              Language
            </label>
            <p className="text-xs text-muted-foreground">
              The language you want the tutor to teach you.
            </p>
          </div>
          <LanguageSelect
            value={code}
            onChange={setCode}
            aria-label="Choose language to learn"
            className="w-full"
          />
          {activeLanguage && (
            <p className="text-xs text-muted-foreground">
              Learning {activeLanguage.name} ({activeLanguage.nativeName}).
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-foreground">
              Expertise level
            </label>
            <p className="text-xs text-muted-foreground">
              How much the tutor should scaffold each lesson.
            </p>
          </div>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-full" aria-label="Choose expertise level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{levelDef.description}</p>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-foreground">
              AI model
            </label>
            <p className="text-xs text-muted-foreground">
              Which free model writes your lessons. These are provided free by
              OpenRouter, so they go offline or get busy without warning — if
              your pick is unavailable, the tutor quietly uses the next one that
              works.
            </p>
          </div>
          <ModelSelect
            value={model}
            onChange={chooseModel}
            models={models}
            disabled={locked}
            isLoading={isLoadingModels}
          />
          <p className="text-xs text-muted-foreground">
            {locked
              ? "The model is fixed by this server's configuration, so it can't be changed here."
              : selectionMissing
                ? `${model} is no longer offered. The tutor is using Auto until you pick another.`
                : selected
                  ? [
                      `Using ${selected.name}`,
                      formatContext(selected.contextLength),
                      selected.recommended
                        ? undefined
                        : "untested with this tutor — it may ignore the lesson format",
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : `Trying the tested models in order, starting with ${
                      firstAutoModel?.name ?? "the best available one"
                    }.`}
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-foreground">
              Appearance
            </label>
            <p className="text-xs text-muted-foreground">
              Dark mode is tuned for long study sessions: a deep navy base
              instead of black, warm off-white text, and a brighter accent so
              the native script stays sharp.
            </p>
          </div>
          <ThemeToggle showLabels />
          <p className="text-xs text-muted-foreground">
            {mode === "system"
              ? `Following your device setting (currently ${resolved}).`
              : `Always ${mode}.`}
          </p>
        </section>
      </div>
    </div>
  );
}
