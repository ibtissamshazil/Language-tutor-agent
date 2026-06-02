import {
  useGetProgressToday,
  getGetProgressTodayQueryKey,
} from "@workspace/api-client-react";
import { Trophy, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function DailyProgressBar() {
  const { data } = useGetProgressToday({
    query: {
      queryKey: getGetProgressTodayQueryKey(),
      refetchOnWindowFocus: true,
    },
  });

  const percent = data?.percent ?? 0;
  const achieved = data?.achieved ?? false;
  const phrases = data?.phrasesLearned ?? 0;

  return (
    <div className="shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {achieved ? (
              <Trophy className="h-4 w-4 text-primary" />
            ) : (
              <Flame className="h-4 w-4 text-primary" />
            )}
            <span>Today's goal</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {achieved
              ? "Goal reached. Great work today."
              : `${phrases} ${phrases === 1 ? "phrase" : "phrases"} learned today`}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full bg-primary transition-all duration-700 ease-out",
              achieved && "bg-gradient-to-r from-primary to-amber-500",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
