import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Copy, ExternalLink, Check, SkipForward, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/vendor-utils";
import { ResponseActions } from "@/components/ResponseActions";
import { VendorTimeline } from "@/components/VendorTimeline";

interface ChannelDashboardProps {
  channel: "instagram" | "whatsapp" | "email";
  title: string;
  icon: string;
  hasField: string;
  statusField: string;
  contactedAtField: string;
  followUpDays: number;
  embedded?: boolean;
}

export default function ChannelDashboard({ channel, title, icon, hasField, statusField, contactedAtField, followUpDays, embedded = false }: ChannelDashboardProps) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await (supabase.from("vendors").select("*") as any).eq(hasField, true);
    setVendors((data as any[]) ?? []);
  };

  useEffect(() => { fetchData(); }, [hasField]);

  const stats = useMemo(() => {
    const eligible = vendors.length;
    const sent = vendors.filter(v => v[statusField] === "sent" || v[statusField] === "followed_up").length;
    const pending = vendors.filter(v => v[statusField] === "pending").length;
    const cutoff = new Date(Date.now() - followUpDays * 24 * 60 * 60 * 1000);
    const followUpReady = vendors.filter(v => v[statusField] === "sent" && v[contactedAtField] && new Date(v[contactedAtField]) < cutoff).length;
    return { eligible, sent, pending, followUpReady };
  }, [vendors]);

  const filtered = useMemo(() => {
    return vendors.filter(v => {
      if (filterCat !== "all" && v.category !== filterCat) return false;
      if (search) {
        const s = search.toLowerCase();
        const match = (v.username || "").includes(s) || (v.full_name || "").toLowerCase().includes(s) || (v.phone || "").includes(s) || (v.email || "").includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [vendors, filterCat, search]);

  useEffect(() => {
    setPage(1);
  }, [filterCat, search]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", duration: 1500 });
  };

  const markStatus = async (id: string, status: string) => {
    const update: Record<string, any> = { [statusField]: status };
    if (status === "sent") update[contactedAtField] = new Date().toISOString();
    await supabase.from("vendors").update(update).eq("id", id);
    fetchData();
  };

  const getMessage = (v: any) => {
    if (channel === "instagram") return v.insta_message || "";
    if (channel === "whatsapp") return v.whatsapp_message || "";
    if (channel === "email") return v.email_body || "";
    return "";
  };

  const getActionLink = (v: any) => {
    if (channel === "instagram") return v.profile_url;
    if (channel === "whatsapp") return `https://wa.me/91${v.phone}?text=${encodeURIComponent(v.whatsapp_message || "")}`;
    if (channel === "email") return `mailto:${v.email}?subject=${encodeURIComponent(v.email_subject || "")}&body=${encodeURIComponent(v.email_body || "")}`;
    return "";
  };

  const getIdentifier = (v: any) => {
    if (channel === "instagram") return v.username ? `@${v.username}` : "—";
    if (channel === "whatsapp") return v.phone || "—";
    if (channel === "email") return v.email || "—";
    return "—";
  };

  const statCards = [
    { label: `${title} Eligible`, value: stats.eligible },
    { label: "Sent", value: stats.sent },
    { label: "Pending", value: stats.pending },
    { label: "Follow-up Ready", value: stats.followUpReady },
  ];

  return (
    <div className={`space-y-6 ${embedded ? "" : "animate-fade-in"}`}>
      {!embedded && <h1 className="text-2xl font-bold tracking-tight">{icon} {title}</h1>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendors</CardTitle>
          <div className="flex gap-3 mt-2">
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-60" />
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{channel === "instagram" ? "Username" : channel === "whatsapp" ? "Phone" : "Email"}</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contacted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                <TableHead>Response</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-sm">{getIdentifier(v)}</TableCell>
                  <TableCell className="text-sm font-medium cursor-pointer hover:text-primary" onClick={() => setSelectedVendorId(v.id)}>{v.full_name}</TableCell>
                  <TableCell className="text-xs">{v.category}</TableCell>
                  <TableCell className="text-xs">{v.city}</TableCell>
                  <TableCell><StatusBadge status={v[statusField]} /></TableCell>
                  <TableCell className="text-xs">{v[contactedAtField] ? new Date(v[contactedAtField]).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(getMessage(v))} title="Copy Message"><Copy className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild title={`Open ${title}`}>
                        <a href={getActionLink(v)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                      {v[statusField] === "pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-status-sent" onClick={() => markStatus(v.id, "sent")} title="Mark Sent"><Check className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-status-skipped" onClick={() => markStatus(v.id, "skipped")} title="Skip"><SkipForward className="h-3.5 w-3.5" /></Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ResponseActions vendorId={v.id} currentStatus={v.overall_status} channel={channel} onUpdate={fetchData} compact />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No vendors found</TableCell></TableRow>
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
        vendorId={selectedVendorId}
        open={!!selectedVendorId}
        onOpenChange={(open) => { if (!open) setSelectedVendorId(null); }}
        onUpdate={fetchData}
      />
    </div>
  );
}
