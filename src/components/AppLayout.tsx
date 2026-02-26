import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-4">
            <SidebarTrigger />
            {currentUser && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{currentUser.name}</span>
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${currentUser.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                  {currentUser.role}
                </span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={logout}>
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </header>
          <div className="p-3 sm:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
