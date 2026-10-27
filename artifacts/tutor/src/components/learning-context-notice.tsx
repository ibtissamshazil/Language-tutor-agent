import { useState } from "react";
import { X } from "lucide-react";

/** Dismissal lasts only until the learner leaves and reopens Lessons. */
export function LearningContextNotice() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;
  return (
    <aside aria-label="Saved learning context" className="relative mb-6 rounded-xl border border-border bg-muted/40 p-4 pr-12 text-sm text-muted-foreground">
      <button
        type="button"
        aria-label="Dismiss learning context notice"
        onClick={() => setVisible(false)}
        className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      Your tutor uses a limited summary of your saved chats and lesson completions in this language, private to your account.
      {" "}Deleting a chat removes its contribution to future summaries; unmarking a lesson removes its completion status.
      {" "}Taught or completed does not mean mastered.
    </aside>
  );
}
