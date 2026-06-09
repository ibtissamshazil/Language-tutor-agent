import { useListLessons, getListLessonsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Book } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/hooks/use-language";

export default function LessonsPage() {
  const { code: languageCode, language } = useLanguage();
  const params = { language: languageCode };
  const { data: lessons, isLoading } = useListLessons(params, {
    query: { queryKey: getListLessonsQueryKey(params) },
  });

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-8 lg:py-12 max-w-5xl mx-auto w-full">
      <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">Beginner Lessons</h1>
        <p className="text-xl text-muted-foreground">
          Master the basics of {language.name} with these foundational topics.
        </p>
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
          lessons?.map((lesson, i) => (
            <Link key={lesson.slug} href={`/lessons/${lesson.slug}`} className="block">
              <Card className="h-full border-card-border hover:border-primary/50 hover:shadow-md transition-all duration-300 group bg-card cursor-pointer overflow-hidden animate-in fade-in zoom-in-95" style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}>
                <CardHeader>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Book className="h-5 w-5" />
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
          ))
        )}
      </div>
    </div>
  );
}