import { Link, useLocation, useRoute } from "wouter";
import { 
  useListOpenaiConversations, 
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, BookOpen, Plus, Trash2, Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { LanguageSelect } from "@/components/language-select";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: conversations } = useListOpenaiConversations();
  const deleteConversation = useDeleteOpenaiConversation();
  const queryClient = useQueryClient();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [isLessons] = useRoute("/lessons*");
  const [isHome] = useRoute("/");
  const { code: languageCode, setCode: setLanguageCode } = useLanguage();

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    deleteConversation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        if (location === `/chat/${id}`) {
          setLocation("/");
        }
      }
    });
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border w-64 md:w-72 shadow-sm">
      <div className="p-4 sm:p-6 pb-4">
        <h1 className="text-2xl font-bold text-primary tracking-tight">Lingo Tutor</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium">Your personal language companion</p>
      </div>

      <div className="px-4 pb-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Learning
        </label>
        <LanguageSelect
          value={languageCode}
          onChange={setLanguageCode}
          aria-label="Choose language to learn"
          className="mt-1.5 w-full"
        />
      </div>

      <div className="px-4 py-2 space-y-2">
        <Button 
          variant={isHome ? "secondary" : "ghost"} 
          className="w-full justify-start font-medium"
          onClick={() => { setLocation("/"); setIsMobileOpen(false); }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Conversation
        </Button>
        <Button 
          variant={isLessons ? "secondary" : "ghost"} 
          className="w-full justify-start font-medium"
          onClick={() => { setLocation("/lessons"); setIsMobileOpen(false); }}
        >
          <BookOpen className="mr-2 h-4 w-4" />
          Lessons
        </Button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col mt-4">
        <div className="px-6 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Conversations
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 pb-4">
            {conversations?.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center justify-between rounded-md px-3 py-2 text-sm cursor-pointer transition-colors duration-200",
                  location === `/chat/${conv.id}`
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                onClick={() => { setLocation(`/chat/${conv.id}`); setIsMobileOpen(false); }}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">{conv.title || "New Chat"}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0 transition-opacity"
                  onClick={(e) => handleDelete(e, conv.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {conversations?.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No past conversations.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      {/* Mobile Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 flex items-center p-4 bg-background/80 backdrop-blur-md border-b border-border">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 -ml-2 text-primary">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-r-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <div className="ml-2 font-bold text-lg text-primary">Lingo Tutor</div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full">
        <SidebarContent />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative pt-16 md:pt-0 bg-background/50">
        {children}
      </main>
    </div>
  );
}