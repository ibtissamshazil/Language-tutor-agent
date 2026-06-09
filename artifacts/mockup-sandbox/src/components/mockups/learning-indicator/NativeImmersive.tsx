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

export function NativeImmersive() {
  return (
    <SidebarShell>
      <div className="px-4 pb-2">
        <div
          className="relative overflow-hidden rounded-xl border border-[hsl(var(--app-sidebar-border))] px-4 py-3.5"
          style={{ background: "linear-gradient(135deg, hsl(var(--app-primary) / 0.10), hsl(var(--app-sidebar-accent) / 0.5))" }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--app-primary))]">
            Learning
          </div>
          <div
            className="font-urdu text-3xl leading-[1.6] text-[hsl(var(--app-sidebar-fg))] mt-0.5"
            dir="rtl"
          >
            اردو
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--app-muted-fg))]">
            Urdu
          </div>
        </div>
      </div>
    </SidebarShell>
  );
}
