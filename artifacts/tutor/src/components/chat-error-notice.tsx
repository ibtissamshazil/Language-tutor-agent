import { Link } from "wouter";
import { AlertTriangle, Clock, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatError } from "@/hooks/use-chat";

// What the student sees when a reply fails.
//
// The server already explains the reason in plain words; this adds the way
// out. Which way out depends on the failure: a busy or retired model is fixed
// by choosing a different one, an exhausted daily quota only by waiting, and a
// rejected API key by neither — so the actions are driven by the error's code
// rather than shown unconditionally.

const TITLES: Record<string, string> = {
  rate_limited: "This model is busy",
  daily_limit: "Today's free requests are used up",
  model_unavailable: "That model is gone",
  model_gated: "That model is off-limits",
  refused: "The model wouldn't answer that",
  truncated: "The reply may be unfinished",
  provider_down: "The AI provider is struggling",
  timeout: "The model took too long",
  context_too_long: "This conversation got too long",
  no_credits: "Out of credits",
  auth: "The API key was rejected",
  network: "Couldn't reach the AI provider",
  empty_reply: "The model said nothing",
  save_failed: "The reply wasn't saved",
  interrupted: "The reply was cut short",
  request_failed: "The message couldn't be sent",
};

function waitLabel(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 90) return `Try again in ${Math.max(10, Math.round(seconds / 10) * 10)} seconds`;
  if (seconds < 5400) return `Try again in about ${Math.round(seconds / 60)} minutes`;
  const hours = Math.round(seconds / 3600);
  return `Try again in about ${hours === 1 ? "an hour" : `${hours} hours`}`;
}

export function ChatErrorNotice({ error }: { error: ChatError }) {
  const title = (error.code && TITLES[error.code]) || "Something went wrong";
  const wait = waitLabel(error.retryAfterSeconds);
  // A truncated reply is not a failure — the lesson is on screen and saved —
  // so it gets a quiet note rather than the alarming red card.
  const soft = error.code === "truncated";

  return (
    <div
      role={soft ? "status" : "alert"}
      className={cn(
        "mx-auto max-w-lg rounded-xl border px-4 py-3 text-sm",
        soft
          ? "border-border bg-muted/60 text-muted-foreground"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <div className="flex gap-3">
        {soft ? (
          <Clock className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        )}
        <div className="space-y-2 min-w-0">
          <p className="font-semibold leading-tight">{title}</p>
          <p className={cn("leading-relaxed", !soft && "text-destructive/90")}>{error.message}</p>
          {(wait || error.suggestModelChange) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs">
              {wait && (
                <span className="inline-flex items-center gap-1.5 text-destructive/80">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {wait}
                </span>
              )}
              {error.suggestModelChange && (
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 font-medium underline underline-offset-2 hover:no-underline"
                >
                  <Settings2 className="h-3.5 w-3.5" aria-hidden />
                  Choose another model
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
