import { useState } from "react";
import { LANGUAGES, LEVELS } from "@workspace/languages";
import { useListModels } from "@workspace/api-client-react";
import { useLanguage } from "@/hooks/use-language";
import {
  AUTO_MODEL,
  getPreferredModel,
  setPreferredModel,
} from "@/lib/model-preference";
import { LanguageSelect } from "@/components/language-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/hooks/use-theme";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SettingsPage() {
  const { code, setCode, level, setLevel, levelDef } = useLanguage();
  const { mode, resolved } = useTheme();

  const activeLanguage = LANGUAGES.find((l) => l.code === code);

  const [model, setModel] = useState(getPreferredModel);
  const { data: modelData, isLoading: isLoadingModels } = useListModels();
  const models = modelData?.models ?? [];
  const recommended = models.filter((m) => m.recommended);
  const others = models.filter((m) => !m.recommended);
  const selected = models.find((m) => m.id === model);
  // A previously picked model that upstream has since retired is no longer in
  // the list; say so rather than showing an empty select.
  const selectionMissing = model !== AUTO_MODEL && !selected && !isLoadingModels;

  const chooseModel = (value: string) => {
    setModel(value);
    setPreferredModel(value);
  };

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
          <Select
            value={model}
            onValueChange={chooseModel}
            disabled={modelData?.locked || isLoadingModels}
          >
            <SelectTrigger className="w-full" aria-label="Choose AI model">
              <SelectValue placeholder={isLoadingModels ? "Loading models…" : "Auto"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO_MODEL}>Auto (recommended)</SelectItem>
              {recommended.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Tested with this tutor</SelectLabel>
                  {recommended.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.note ? ` — ${m.note}` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {others.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Other free models (untested)</SelectLabel>
                  {others.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {modelData?.locked
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
                      recommended[0]?.name ?? "the best available one"
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
