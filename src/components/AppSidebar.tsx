import { Upload, LayoutDashboard, Target, AlertCircle, Flame, Home, BarChart3, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Today", url: "/", icon: Home },
  { title: "Upload", url: "/upload", icon: Upload },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Outreach", url: "/outreach", icon: Target },
  { title: "Hot Leads", url: "/hot-leads", icon: Flame },
  { title: "Review Queue", url: "/review", icon: AlertCircle },
];


export function AppSidebar() {
  const location = useLocation();
  const [reviewCount, setReviewCount] = useState(0);
  const [hotLeadsCount, setHotLeadsCount] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      const [{ data: flagged }, { data: uncategorized }, { data: unknownCity }, { count: hotLeads }] = await Promise.all([
        supabase.from("vendors").select("id").eq("needs_review", true).neq("overall_status", "invalid"),
        supabase.from("vendors").select("id").eq("category", "uncategorized").neq("overall_status", "invalid"),
        supabase.from("vendors").select("id").eq("city", "Unknown").neq("overall_status", "invalid"),
        supabase.from("vendors").select("id", { count: "exact", head: true }).eq("overall_status", "interested"),
      ]);
      const ids = new Set<string>();
      for (const v of [...(flagged ?? []), ...(uncategorized ?? []), ...(unknownCity ?? [])]) ids.add(v.id);
      setReviewCount(ids.size);
      setHotLeadsCount(hotLeads ?? 0);
    };
    fetchCounts();
    const handler = () => fetchCounts();
    window.addEventListener("vendors-updated", handler);
    return () => window.removeEventListener("vendors-updated", handler);
  }, [location.pathname]);

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar className="border-r-0">
      <div className="flex h-14 items-center gap-2 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-primary-foreground">CE</span>
        </div>
        <span className="text-sm font-semibold text-sidebar-accent-foreground">CartEvent Outreach</span>
      </div>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={item.url === "/"} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.title === "Review Queue" && reviewCount > 0 && (
                        <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground">
                          {reviewCount}
                        </span>
                      )}
                      {item.title === "Hot Leads" && hotLeadsCount > 0 && (
                        <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[10px] font-medium text-sidebar-primary-foreground">
                          {hotLeadsCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/settings"}>
                  <NavLink to="/settings" end activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                    <Settings className="h-4 w-4" />
                    <span className="flex-1">Settings</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
