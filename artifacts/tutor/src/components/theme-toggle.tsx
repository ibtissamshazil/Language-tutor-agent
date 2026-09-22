import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeMode } from "@/hooks/use-theme";

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "Auto", icon: Monitor },
];

/**
 * Segmented light / dark / auto switch.
 *
 * `showLabels` renders the wider labelled version used on the settings page;
 * the compact icon-only version sits in the sidebar footer.
 */
export function ThemeToggle({
  showLabels = false,
  className,
}: {
  showLabels?: boolean;
  className?: string;
}) {
  const { mode, setMode } = useTheme();

  // Radio-group keyboard semantics: the group is a single tab stop (only the
  // checked option is tabbable) and arrow keys move the selection, wrapping at
  // the ends. Home/End jump to the first/last option.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    const current = OPTIONS.findIndex((o) => o.mode === mode);
    const last = OPTIONS.length - 1;
    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = current >= last ? 0 : current + 1;
    else next = current <= 0 ? last : current - 1;

    setMode(OPTIONS[next].mode);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>(
      "[role='radio']",
    );
    buttons[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-muted/60 p-1",
        showLabels && "w-full",
        className,
      )}
    >
      {OPTIONS.map(({ mode: option, label, icon: Icon }) => {
        const isActive = mode === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={`${label} theme`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => setMode(option)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
              "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              showLabels && "flex-1",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {showLabels && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
