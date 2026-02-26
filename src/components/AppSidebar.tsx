import { Upload, LayoutDashboard, Target, AlertCircle, Flame, Home, BarChart3, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

const allMainItems = [
  { title: "Today", url: "/", icon: Home, adminOnly: false },
  { title: "Upload", url: "/upload", icon: Upload, adminOnly: true },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, adminOnly: false },
  { title: "Analytics", url: "/analytics", icon: BarChart3, adminOnly: true },
  { title: "Outreach", url: "/outreach", icon: Target, adminOnly: false },
  { title: "Hot Leads", url: "/hot-leads", icon: Flame, adminOnly: false },
  { title: "Review Queue", url: "/review", icon: AlertCircle, adminOnly: true },
];


export function AppSidebar() {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [reviewCount, setReviewCount] = useState(0);
  const [hotLeadsCount, setHotLeadsCount] = useState(0);

  const mainItems = useMemo(() => {
    const isAdmin = currentUser?.role === "admin";
    return allMainItems.filter(item => !item.adminOnly || isAdmin);
  }, [currentUser]);

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
                    <span className="flex-1">{currentUser?.role === "admin" ? "Settings" : "My Settings"}</span>
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
