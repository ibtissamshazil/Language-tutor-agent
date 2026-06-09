import './_group.css';
import { Plus, BookOpen, Settings } from "lucide-react";

function SidebarShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-scope min-h-screen w-full bg-[hsl(var(--app-bg))] flex justify-center py-8 px-6">
      <div className="w-72 rounded-xl overflow-hidden border border-[hsl(var(--app-sidebar-border))] bg-[hsl(var(--app-sidebar))] shadow-sm">
        <div className="p-5 pb-3">
          <h1 className="text-xl font-bold tracking-tight text-[hsl(var(--app-primary))]">Language Tutor</h1>
          <p className="text-xs mt-1 font-medium text-[hsl(var(--app-muted-fg))]">Your personal language companion</p>
        </div>
        {children}
        <div className="px-3 py-3 space-y-1 opacity-50">
          {[["New Conversation", Plus], ["Lessons", BookOpen], ["Settings", Settings]].map(([label, Icon]: any) => (
            <div key={label} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[hsl(var(--app-sidebar-fg))]">
              <Icon className="h-4 w-4" /> {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GlyphAvatar() {
  return (
    <SidebarShell>
      <div className="px-4 pb-2">
        <div className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--app-muted-fg))] mb-1.5">
          Learning
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--app-sidebar-border))] bg-[hsl(var(--app-sidebar-accent))]/40 px-3 py-2.5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-urdu text-xl text-[hsl(var(--app-primary))]"
            style={{ background: "hsl(var(--app-primary) / 0.12)" }}
            dir="rtl"
          >
            ا
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[hsl(var(--app-sidebar-fg))] leading-tight">Urdu</div>
            <div className="text-sm text-[hsl(var(--app-muted-fg))] font-urdu leading-tight" dir="rtl">اردو</div>
          </div>
        </div>
      </div>
    </SidebarShell>
  );
}
