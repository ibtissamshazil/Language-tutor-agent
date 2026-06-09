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

function ProgressRing({ value, goal }: { value: number; goal: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const pct = Math.min(value / goal, 1);
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" stroke="hsl(var(--app-primary) / 0.15)" />
      <circle
        cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
        stroke="hsl(var(--app-primary))"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
      />
      <text x="22" y="22" transform="rotate(90 22 22)" textAnchor="middle" dominantBaseline="central"
        className="font-bold" style={{ fontSize: "12px", fill: "hsl(var(--app-sidebar-fg))" }}>
        {value}
      </text>
    </svg>
  );
}

export function ProgressBadge() {
  return (
    <SidebarShell>
      <div className="px-4 pb-2">
        <div className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--app-muted-fg))] mb-1.5">
          Learning
        </div>
        <div className="rounded-xl border border-[hsl(var(--app-sidebar-border))] bg-[hsl(var(--app-sidebar-accent))]/40 px-3 py-3">
          <div className="flex items-center gap-3">
            <ProgressRing value={12} goal={20} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[hsl(var(--app-sidebar-fg))] leading-tight">
                Urdu <span className="font-urdu text-[hsl(var(--app-muted-fg))]" dir="rtl">اردو</span>
              </div>
              <div className="text-xs text-[hsl(var(--app-muted-fg))] leading-tight mt-0.5">
                12 of 20 words today
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarShell>
  );
}
