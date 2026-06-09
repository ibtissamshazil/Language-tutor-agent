import {
  useGetProgressToday,
  getGetProgressTodayQueryKey,
} from "@workspace/api-client-react";
import type { LanguageDef } from "@workspace/languages";
import { cn } from "@/lib/utils";

function ProgressRing({
  percent,
  value,
  achieved,
}: {
  percent: number;
  value: number;
  achieved: boolean;
}) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(percent, 0), 100) / 100;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90">
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        strokeWidth="4"
        style={{ stroke: "hsl(var(--primary) / 0.15)" }}
      />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
        style={{ stroke: "hsl(var(--primary))" }}
      />
      {achieved ? (
        <path
          transform="rotate(90 22 22)"
          d="M16 22.5 l4 4 l8 -9"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: "hsl(var(--primary))" }}
        />
      ) : (
        <text
          x="22"
          y="22"
          transform="rotate(90 22 22)"
          textAnchor="middle"
          dominantBaseline="central"
          className="font-bold"
          style={{ fontSize: "12px", fill: "hsl(var(--sidebar-foreground))" }}
        >
          {value}
        </text>
      )}
    </svg>
  );
}

export function LearningBadge({ language }: { language: LanguageDef }) {
  const params = { language: language.code };
  const { data } = useGetProgressToday(params, {
    query: {
      queryKey: getGetProgressTodayQueryKey(params),
      refetchOnWindowFocus: true,
    },
  });

  const percent = data?.percent ?? 0;
  const achieved = data?.achieved ?? false;
  const words = data?.wordsLearned ?? 0;
  const target = data?.target ?? 0;
  const hasNative =
    !!language.nativeName && language.nativeName !== language.name;

  return (
    <div className="px-4 pb-2">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
        Learning
      </div>
      <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-3">
        <div className="flex items-center gap-3">
          <ProgressRing percent={percent} value={words} achieved={achieved} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-sidebar-foreground leading-tight">
              {language.name}
              {hasNative && (
                <span
                  className={cn("ml-1.5 font-normal text-muted-foreground", language.fontClass)}
                  dir={language.direction}
                >
                  {language.nativeName}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs leading-tight text-muted-foreground">
              {achieved
                ? "Goal reached today"
                : `${words} of ${target} words today`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
