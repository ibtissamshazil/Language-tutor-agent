import { useMemo, useState } from "react";
import {
  useListLessons,
  getListLessonsQueryKey,
  useListLessonCompletions,
  getListLessonCompletionsQueryKey,
} from "@workspace/api-client-react";
import { LEVELS, type LevelCode } from "@workspace/languages";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Book, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

// Level order (beginner -> intermediate -> advanced) used for cumulative
// visibility and proximity sorting.
const LEVEL_ORDER = LEVELS.map((l) => l.code);
const levelRank = (code: string) => {
  const i = LEVEL_ORDER.indexOf(code as LevelCode);
  return i === -1 ? 0 : i;
};

const LEVEL_BADGE: Record<LevelCode, string> = {
  beginner: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  intermediate: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  advanced: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const levelName = (code: string) =>
  LEVELS.find((l) => l.code === code)?.name ?? code;

type Filter = "all" | LevelCode;

export default function LessonsPage() {
  const { code: languageCode, language, level: activeLevel } = useLanguage();
  const [filter, setFilter] = useState<Filter>("all");

  const params = { language: languageCode };
  const { data: lessons, isLoading } = useListLessons(params, {
    query: { queryKey: getListLessonsQueryKey(params) },
  });

  const completionsParams = { language: languageCode };
  const { data: completions } = useListLessonCompletions(completionsParams, {
    query: { queryKey: getListLessonCompletionsQueryKey(completionsParams) },
  });
  const completedSlugs = new Set(completions?.completedSlugs ?? []);

  const activeRank = levelRank(activeLevel);

  // Levels the learner can see: everything up to and including their chosen
  // expertise (beginner -> only beginner; advanced -> all three).
  const visibleLevels = LEVELS.filter((_, i) => i <= activeRank);

  // Lessons up to the learner's level, sorted by proximity to the chosen
  // expertise (selected level first, then the nearest levels).
  const visibleLessons = useMemo(() => {
    if (!lessons) return [];
    return [...lessons]
      .filter((l) => levelRank(l.level) <= activeRank)
      .sort((a, b) => {
        const da = Math.abs(levelRank(a.level) - activeRank);
        const db = Math.abs(levelRank(b.level) - activeRank);
        if (da !== db) return da - db;
        return levelRank(a.level) - levelRank(b.level);
      });
  }, [lessons, activeRank]);

  const displayed =
    filter === "all"
      ? visibleLessons
      : visibleLessons.filter((l) => l.level === filter);

  const totalCount = displayed.length;
  const completedCount = displayed.filter((l) => completedSlugs.has(l.slug)).length;

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-8 lg:py-12 max-w-5xl mx-auto w-full">
      <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">Lessons</h1>
        <p className="text-xl text-muted-foreground">
          Build your {language.name} step by step — showing topics up to your{" "}
          {levelName(activeLevel)} level.
        </p>
        {totalCount > 0 && (
          <div className="mt-6 max-w-md">
            <div className="flex items-center justify-between text-sm font-medium mb-2">
              <span className="text-muted-foreground">Lessons completed</span>
              <span className="text-foreground">
                {completedCount} of {totalCount}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Level filter — only shown when more than one level is available. */}
      {visibleLevels.length > 1 && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <Button
            variant={filter === "all" ? "secondary" : "outline"}
            size="sm"
            className="rounded-full font-medium"
            onClick={() => setFilter("all")}
          >
            All levels
          </Button>
          {visibleLevels.map((lvl) => (
            <Button
              key={lvl.code}
              variant={filter === lvl.code ? "secondary" : "outline"}
              size="sm"
              className="rounded-full font-medium"
              onClick={() => setFilter(lvl.code)}
            >
              {lvl.name}
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-card-border overflow-hidden h-[200px]">
              <CardHeader className="space-y-3">
                <Skeleton className="h-8 w-12 rounded-lg" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardHeader>
            </Card>
          ))
        ) : (
          displayed.map((lesson, i) => {
            const completed = completedSlugs.has(lesson.slug);
            return (
            <Link key={lesson.slug} href={`/lessons/${lesson.slug}`} className="block">
              <Card className={cn(
                "h-full border-card-border hover:border-primary/50 hover:shadow-md transition-all duration-300 group bg-card cursor-pointer overflow-hidden animate-in fade-in zoom-in-95",
                completed && "border-primary/40 bg-primary/5",
              )} style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}>
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform",
                      completed ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                    )}>
                      {completed ? <CheckCircle2 className="h-5 w-5" /> : <Book className="h-5 w-5" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-semibold uppercase tracking-wider rounded-full px-2.5 py-1",
                        LEVEL_BADGE[lesson.level as LevelCode] ?? LEVEL_BADGE.beginner,
                      )}>
                        {levelName(lesson.level)}
                      </span>
                      {completed && (
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">
                    {lesson.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {lesson.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
