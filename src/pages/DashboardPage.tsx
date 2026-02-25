import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { VendorTimeline } from "@/components/VendorTimeline";
import { Users, UserCheck, UserX, Heart, Trophy, ChevronLeft, ChevronRight, Instagram, Phone, Mail, Globe, ThumbsDown, Ban } from "lucide-react";
import { CATEGORIES } from "@/lib/vendor-utils";
import { ResponseActions } from "@/components/ResponseActions";
import ChannelDashboard from "./ChannelDashboard";

function computeOverallStatus(v: any): string {
  if (v.overall_status === "invalid") return "invalid";
  if (v.overall_status === "converted") return "converted";
  if (v.overall_status === "interested") return "interested";
  if (v.overall_status === "not_interested" || v.overall_status === "declined" || v.overall_status === "maybe_later") return "not_interested";
  const channels: { has: boolean; status: string }[] = [
    { has: v.has_instagram, status: v.insta_status },
    { has: v.has_phone, status: v.whatsapp_status },
    { has: v.has_email, status: v.email_status },
  ];
  const available = channels.filter(c => c.has);
  if (available.length === 0) return "pending";
  const allExhausted = available.every(c => c.status === "followed_up" || c.status === "skipped");
  if (allExhausted) return "exhausted";
  const anyUsed = available.some(c => c.status !== "pending");
  if (anyUsed) return "contacted";
  return "pending";
}

function OverviewTab() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [filterCat, setFilterCat] = useState("all");
  const [filterCity, setFilterCity] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const fetchData = async () => {
    const { data: allVendors } = await supabase.from("vendors").select("*");
    setVendors(allVendors ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const cities = useMemo(() => [...new Set(vendors.map(v => v.city))].sort(), [vendors]);

  const stats = useMemo(() => {
    const statusMap = vendors.map(v => computeOverallStatus(v));
    const invalid = statusMap.filter(s => s === "invalid").length;
    const total = vendors.length - invalid;
    const contacted = statusMap.filter(s => s === "contacted").length;
    const pending = statusMap.filter(s => s === "pending").length;
    const interested = statusMap.filter(s => s === "interested").length;
    const converted = statusMap.filter(s => s === "converted").length;
    const notInterested = statusMap.filter(s => s === "not_interested").length;
    const exhausted = statusMap.filter(s => s === "exhausted").length;
    return { total, contacted, pending, interested, converted, notInterested, exhausted, invalid };
  }, [vendors]);

  const filtered = useMemo(() => {
    return vendors.filter(v => {
      const os = computeOverallStatus(v);
      if (filterStatus === "all" && os === "invalid") return false;
      if (filterStatus !== "all" && os !== filterStatus) return false;
      if (filterCat !== "all" && v.category !== filterCat) return false;
      if (filterCity !== "all" && v.city !== filterCity) return false;
      if (search) {
        const s = search.toLowerCase();
        return (v.username || "").includes(s) || (v.full_name || "").toLowerCase().includes(s) || (v.phone || "").includes(s) || (v.email || "").includes(s);
      }
      return true;
    });
  }, [vendors, filterCat, filterCity, filterStatus, search]);

  useEffect(() => {
    setPage(1);
  }, [filterCat, filterCity, filterStatus, search]);

  const statCards = [
    { label: "Total", value: stats.total, icon: Users, filter: "all" },
    { label: "Pending", value: stats.pending, icon: UserX, filter: "pending" },
    { label: "Contacted", value: stats.contacted, icon: UserCheck, filter: "contacted" },
    { label: "Interested", value: stats.interested, icon: Heart, filter: "interested" },
    { label: "Not Interested", value: stats.notInterested, icon: ThumbsDown, filter: "not_interested" },
    { label: "Converted", value: stats.converted, icon: Trophy, filter: "converted" },
    { label: "Exhausted", value: stats.exhausted, icon: Ban, filter: "exhausted" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-7 gap-3">
        {statCards.map(s => (
          <Card
            key={s.label}
            className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${filterStatus === s.filter ? "border-primary shadow-sm" : ""}`}
            onClick={() => setFilterStatus(filterStatus === s.filter ? "all" : s.filter)}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-3">
                <s.icon className="h-5 w-5 text-muted-foreground opacity-50 shrink-0" />
                <div>
                  <p className="text-xl font-bold leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="w-56" />
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCity} onValueChange={setFilterCity}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="not_interested">Not Interested</SelectItem>
                <SelectItem value="exhausted">Exhausted</SelectItem>
                <SelectItem value="invalid">Removed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto pt-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60">
                <TableHead className="w-[200px] font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">Business</TableHead>
                <TableHead className="w-[110px] font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">Category</TableHead>
                <TableHead className="w-[80px] font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">City</TableHead>
                <TableHead className="w-[160px] font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">
                  <div className="flex items-center gap-1.5">
                    <Instagram className="h-3.5 w-3.5" /> Instagram
                  </div>
                </TableHead>
                <TableHead className="w-[160px] font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> WhatsApp
                  </div>
                </TableHead>
                <TableHead className="w-[180px] font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </div>
                </TableHead>
                <TableHead className="w-[120px] font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Website
                  </div>
                </TableHead>
                <TableHead className="w-[90px] font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">Overall</TableHead>
                <TableHead className="w-[140px] font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">Response</TableHead>
                <TableHead className="w-[150px] font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(v => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors group"
                  onClick={() => setSelectedVendor(v)}
                >
                  <TableCell className="py-3.5">
                    <p className="font-medium text-sm leading-snug">{v.full_name}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{CATEGORIES.find(c => c.key === v.category)?.label ?? v.category}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.city}</TableCell>
                  <TableCell className="py-3.5">
                    {v.has_instagram ? (
                      <div className="space-y-1">
                        <StatusBadge status={v.insta_status} />
                        {v.username && (
                          <p className="text-[11px] text-muted-foreground font-mono">@{v.username}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5">
                    {v.has_phone ? (
                      <div className="space-y-1">
                        <StatusBadge status={v.whatsapp_status} />
                        <p className="text-[11px] text-muted-foreground font-mono">{v.phone}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5">
                    {v.has_email ? (
                      <div className="space-y-1">
                        <StatusBadge status={v.email_status} />
                        <p className="text-[11px] text-muted-foreground truncate max-w-[150px]">{v.email}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5">
                    {v.website ? (
                      <a href={v.website.startsWith("http") ? v.website : `https://${v.website}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate max-w-[100px] block" onClick={e => e.stopPropagation()}>
                        {v.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 25)}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5"><StatusBadge status={computeOverallStatus(v)} /></TableCell>
                  <TableCell className="py-3.5">
                    <ResponseActions vendorId={v.id} currentStatus={v.overall_status} computedStatus={computeOverallStatus(v)} onUpdate={fetchData} compact />
                  </TableCell>
                  <TableCell className="py-3.5">
                    {v.notes ? (
                      <p className="text-[11px] text-muted-foreground truncate max-w-[140px]" title={v.notes}>{v.notes.split("\n").pop()}</p>
                    ) : (
                      <span className="text-xs text-muted-foreground/30">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No vendors found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 px-2">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}</span>
                <Button variant="outline" size="sm" disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)} onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <VendorTimeline
        vendorId={selectedVendor?.id ?? null}
        open={!!selectedVendor}
        onOpenChange={(open) => { if (!open) setSelectedVendor(null); }}
        onUpdate={fetchData}
      />
    </div>
  );
}

function CallsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Phone className="h-16 w-16 text-muted-foreground/20 mb-4" />
      <h2 className="text-xl font-semibold text-muted-foreground mb-2">Coming Soon</h2>
      <p className="text-muted-foreground max-w-md">
        AI Voice Agent integration for automated vendor calls. Vendors with phone numbers will be eligible.
      </p>
    </div>
  );
}

const TAB_OPTIONS = ["overview", "instagram", "whatsapp", "email", "calls"] as const;
type TabValue = typeof TAB_OPTIONS[number];

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: TabValue = TAB_OPTIONS.includes(rawTab as TabValue) ? (rawTab as TabValue) : "overview";

  const handleTabChange = (value: string) => {
    if (value === "overview") {
      setSearchParams({});
    } else {
      setSearchParams({ tab: value });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="instagram" className="gap-1.5">
            <Instagram className="h-3.5 w-3.5" />
            Instagram
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="calls" className="gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            Calls
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="instagram">
          <ChannelDashboard
            channel="instagram" title="Instagram" icon="📸"
            hasField="has_instagram" statusField="insta_status"
            contactedAtField="insta_contacted_at" followUpDays={5}
            embedded
          />
        </TabsContent>

        <TabsContent value="whatsapp">
          <ChannelDashboard
            channel="whatsapp" title="WhatsApp" icon="💬"
            hasField="has_phone" statusField="whatsapp_status"
            contactedAtField="whatsapp_contacted_at" followUpDays={3}
            embedded
          />
        </TabsContent>

        <TabsContent value="email">
          <ChannelDashboard
            channel="email" title="Email" icon="📧"
            hasField="has_email" statusField="email_status"
            contactedAtField="email_contacted_at" followUpDays={4}
            embedded
          />
        </TabsContent>

        <TabsContent value="calls">
          <CallsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
