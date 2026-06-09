import {
  useListLessons,
  getListLessonsQueryKey,
  useListLessonCompletions,
  getListLessonCompletionsQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Book, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

export default function LessonsPage() {
  const { code: languageCode, language } = useLanguage();
  const params = { language: languageCode };
  const { data: lessons, isLoading } = useListLessons(params, {
    query: { queryKey: getListLessonsQueryKey(params) },
  });

  const completionsParams = { language: languageCode };
  const { data: completions } = useListLessonCompletions(completionsParams, {
    query: { queryKey: getListLessonCompletionsQueryKey(completionsParams) },
  });
  const completedSlugs = new Set(completions?.completedSlugs ?? []);
  const totalCount = lessons?.length ?? 0;
  const completedCount = lessons
    ? lessons.filter((l) => completedSlugs.has(l.slug)).length
    : 0;

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-8 lg:py-12 max-w-5xl mx-auto w-full">
      <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">Beginner Lessons</h1>
        <p className="text-xl text-muted-foreground">
          Master the basics of {language.name} with these foundational topics.
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
          lessons?.map((lesson, i) => {
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
                    {completed && (
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Completed
                      </span>
                    )}
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