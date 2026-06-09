import { useGetLesson, getGetLessonQueryKey } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquarePlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

export default function LessonDetailPage() {
  const [, params] = useRoute("/lessons/:slug");
  const slug = params?.slug || "";
  const { code: languageCode, language } = useLanguage();

  const queryParams = { language: languageCode };
  const { data: lesson, isLoading } = useGetLesson(slug, queryParams, {
    query: { enabled: !!slug, queryKey: getGetLessonQueryKey(slug, queryParams) }
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto w-full p-6 space-y-8">
        <Skeleton className="h-10 w-32" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4">
        <h2 className="text-2xl font-bold">Lesson not found</h2>
        <Link href="/lessons" className="text-primary hover:underline">Return to lessons</Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto w-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 lg:py-12">
        <Link href="/lessons" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Lessons
        </Link>
        
        <div className="mb-12 flex flex-col md:flex-row md:items-start justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
              {lesson.title}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              {lesson.description}
            </p>
          </div>
          <Link href="/" className="shrink-0">
            <Button size="lg" className="rounded-xl w-full md:w-auto font-medium">
              <MessageSquarePlus className="mr-2 h-5 w-5" />
              Practice in Chat
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold mb-6">Key Phrases</h2>
          {lesson.phrases.map((phrase, i) => (
            <div 
              key={i}
              className="bg-card border border-card-border rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-12 items-start md:items-center justify-between shadow-sm hover:shadow-md transition-shadow animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${(i + 1) * 100}ms`, animationFillMode: "both" }}
            >
              <div className="space-y-2 flex-1">
                <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">English</div>
                <div className="text-xl font-medium text-foreground">{phrase.english}</div>
              </div>
              
              <div className="h-px w-full md:w-px md:h-16 bg-border" />
              
              <div className={cn(
                "space-y-4 flex-1 w-full",
                language.direction === "rtl" ? "text-left md:text-right" : "text-left",
              )}>
                <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{language.name}</div>
                <div
                  className={cn("text-3xl sm:text-4xl text-primary", language.fontClass)}
                  dir={language.direction}
                >
                  {phrase.native}
                </div>
                {phrase.transliteration && (
                  <div className="text-lg text-secondary-foreground/80 font-medium italic">
                    "{phrase.transliteration}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}