import './_group.css';
import { Plus, BookOpen, Settings, Globe } from "lucide-react";

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

export function MinimalPill() {
  return (
    <SidebarShell>
      <div className="px-4 pb-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--app-sidebar-border))] bg-[hsl(var(--app-sidebar-accent))]/50 pl-2.5 pr-3 py-1.5">
          <Globe className="h-3.5 w-3.5 text-[hsl(var(--app-primary))]" />
          <span className="text-xs font-semibold text-[hsl(var(--app-sidebar-fg))]">Urdu</span>
          <span className="h-1 w-1 rounded-full bg-[hsl(var(--app-muted-fg))]/50" />
          <span className="text-xs text-[hsl(var(--app-muted-fg))] font-urdu" dir="rtl">اردو</span>
        </div>
      </div>
    </SidebarShell>
  );
}
