import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/80 backdrop-blur-sm px-4">
            <SidebarTrigger />
          </header>
          <div className="p-3 sm:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
