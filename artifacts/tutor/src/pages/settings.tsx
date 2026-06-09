import { LANGUAGES, LEVELS } from "@workspace/languages";
import { useLanguage } from "@/hooks/use-language";
import { LanguageSelect } from "@/components/language-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SettingsPage() {
  const { code, setCode, level, setLevel, levelDef } = useLanguage();

  const activeLanguage = LANGUAGES.find((l) => l.code === code);

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
      </div>
    </div>
  );
}
