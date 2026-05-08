import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Copy, Trophy, ChevronLeft, ChevronRight, Undo2, Loader2,
  UserCheck, Clock, Hand, ThumbsDown, HelpCircle, Flame,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIES } from "@/lib/vendor-utils";

const PAGE_SIZE = 50;
const CLAIM_EXPIRY_HOURS = 24;

type LeadFilter = "all" | "available" | "mine" | "others";

function isClaimExpired(claimedAt: string | null): boolean {
  if (!claimedAt) return true;
  const elapsed = Date.now() - new Date(claimedAt).getTime();
  return elapsed > CLAIM_EXPIRY_HOURS * 60 * 60 * 1000;
}

function getClaimStatus(vendor: any, currentUserId: string): "available" | "mine" | "others" | "expired" {
  if (!vendor.hot_lead_claimed_by) return "available";
  if (isClaimExpired(vendor.hot_lead_claimed_at)) return "expired";
  if (vendor.hot_lead_claimed_by === currentUserId) return "mine";
  return "others";
}

function timeAgo(dateStr: string): string {
  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
  if (hours < 1) return "just now";
  if (hours === 1) return "1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ClaimStatusBadge({ status, agentName, claimedAt }: { status: string; agentName?: string; claimedAt?: string | null }) {
  if (status === "available" || status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <Flame className="h-3 w-3" /> Available
      </span>
    );
  }
  if (status === "mine") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-200">
        <UserCheck className="h-3 w-3" /> You're on it
        {claimedAt && <span className="text-blue-500 ml-0.5">· {timeAgo(claimedAt)}</span>}
      </span>
    );
  }
  // others
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
      <Clock className="h-3 w-3" /> {agentName || "Someone"}
      {claimedAt && <span className="text-amber-500 ml-0.5">· {timeAgo(claimedAt)}</span>}
    </span>
  );
}

export default function HotLeadsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<LeadFilter>("all");
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const fetchData = async () => {
    const [{ data: v }, { data: tm }] = await Promise.all([
      supabase.from("vendors").select("*").eq("overall_status", "interested").order("responded_at", { ascending: false }),
      supabase.from("team_members").select("id, name").eq("is_active", true),
    ]);
    setVendors(v ?? []);
    setTeamMembers(tm ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const agentNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const tm of teamMembers) m.set(tm.id, tm.name);
    return m;
  }, [teamMembers]);

  const filtered = useMemo(() => {
    if (filter === "all") return vendors;
    return vendors.filter(v => {
      const status = getClaimStatus(v, currentUser?.id || "");
      if (filter === "available") return status === "available" || status === "expired";
      if (filter === "mine") return status === "mine";
      if (filter === "others") return status === "others";
      return true;
    });
  }, [vendors, filter, currentUser]);

  const stats = useMemo(() => {
    let available = 0, mine = 0, others = 0;
    for (const v of vendors) {
      const s = getClaimStatus(v, currentUser?.id || "");
      if (s === "available" || s === "expired") available++;
      else if (s === "mine") mine++;
      else others++;
    }
    return { total: vendors.length, available, mine, others };
  }, [vendors, currentUser]);

  const [busy, setBusy] = useState<string | null>(null);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", duration: 1500 });
  };

  // ─── Actions ─────────────────────────────────────────────────────────────

  const claimLead = async (id: string) => {
    if (busy || !currentUser) return;
    setBusy(`claim-${id}`);
    try {
      await supabase.from("vendors").update({
        hot_lead_claimed_by: currentUser.id,
        hot_lead_claimed_at: new Date().toISOString(),
      }).eq("id", id);
      toast({ title: "Lead claimed! You have 24h to convert.", duration: 2500 });
      fetchData();
    } finally {
      setBusy(null);
    }
  };

  const releaseLead = async (id: string) => {
    if (busy) return;
    setBusy(`release-${id}`);
    try {
      await supabase.from("vendors").update({
        hot_lead_claimed_by: null,
        hot_lead_claimed_at: null,
      }).eq("id", id);
      toast({ title: "Lead released", duration: 1500 });
      fetchData();
    } finally {
      setBusy(null);
    }
  };

  const markConverted = async (id: string) => {
    if (busy) return;
    setBusy(`convert-${id}`);
    try {
      await supabase.from("vendors").update({
        overall_status: "converted",
        hot_lead_claimed_by: null,
        hot_lead_claimed_at: null,
      }).eq("id", id);
      toast({ title: "🎉 Marked as converted!", duration: 2000 });
      fetchData();
      window.dispatchEvent(new Event("vendors-updated"));
    } finally {
      setBusy(null);
    }
  };

  const markNotInterested = async (id: string) => {
    if (busy) return;
    setBusy(`notint-${id}`);
    try {
      await supabase.from("vendors").update({
        overall_status: "not_interested",
        hot_lead_claimed_by: null,
        hot_lead_claimed_at: null,
      }).eq("id", id);
      toast({ title: "Marked as not interested", duration: 1500 });
      fetchData();
      window.dispatchEvent(new Event("vendors-updated"));
    } finally {
      setBusy(null);
    }
  };

  const markMaybeLater = async (id: string) => {
    if (busy) return;
    setBusy(`maybe-${id}`);
    try {
      await supabase.from("vendors").update({
        overall_status: "maybe_later",
        hot_lead_claimed_by: null,
        hot_lead_claimed_at: null,
      }).eq("id", id);
      toast({ title: "Marked as maybe later — will re-engage in 30 days", duration: 2500 });
      fetchData();
      window.dispatchEvent(new Event("vendors-updated"));
    } finally {
      setBusy(null);
    }
  };

  const revertToContacted = async (id: string) => {
    if (busy) return;
    setBusy(`revert-${id}`);
    try {
      await supabase.from("vendors").update({
        overall_status: "in_progress",
        responded_at: null,
        responded_channel: null,
        hot_lead_claimed_by: null,
        hot_lead_claimed_at: null,
      }).eq("id", id);
      toast({ title: "Reverted — back in outreach queue", duration: 1500 });
      fetchData();
      window.dispatchEvent(new Event("vendors-updated"));
    } finally {
      setBusy(null);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const getRespondedChannel = (v: any) => {
    if (v.responded_channel === "instagram") return "📸 IG";
    if (v.responded_channel === "whatsapp") return "💬 WA";
    if (v.responded_channel === "email") return "📧 Email";
    return "—";
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🔥 Hot Leads</h1>
          <p className="text-muted-foreground mt-1">{vendors.length} interested vendors ready to convert</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className={`cursor-pointer transition-all hover:shadow-sm ${filter === "all" ? "border-primary shadow-sm" : ""}`}
          onClick={() => setFilter("all")}
        >
          <CardContent className="pt-3 pb-2.5 px-4">
            <p className="text-xl font-bold">{stats.total}</p>
            <p className="text-[11px] text-muted-foreground">Total Leads</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-sm ${filter === "available" ? "border-emerald-500 shadow-sm" : ""}`}
          onClick={() => setFilter(filter === "available" ? "all" : "available")}
        >
          <CardContent className="pt-3 pb-2.5 px-4">
            <p className="text-xl font-bold text-emerald-600">{stats.available}</p>
            <p className="text-[11px] text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-sm ${filter === "mine" ? "border-blue-500 shadow-sm" : ""}`}
          onClick={() => setFilter(filter === "mine" ? "all" : "mine")}
        >
          <CardContent className="pt-3 pb-2.5 px-4">
            <p className="text-xl font-bold text-blue-600">{stats.mine}</p>
            <p className="text-[11px] text-muted-foreground">My Claims</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-sm ${filter === "others" ? "border-amber-500 shadow-sm" : ""}`}
          onClick={() => setFilter(filter === "others" ? "all" : "others")}
        >
          <CardContent className="pt-3 pb-2.5 px-4">
            <p className="text-xl font-bold text-amber-600">{stats.others}</p>
            <p className="text-[11px] text-muted-foreground">Being Worked</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg border border-dashed p-3 flex items-start gap-3 bg-muted/30">
        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Claim a lead to let others know you're working on it. Claims auto-expire after <strong>24 hours</strong> — if you haven't converted by then, the lead becomes available for anyone to pick up.
        </p>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/60">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">Category</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">City</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">Channel</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">Responded</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">Status</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">Notes</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(v => {
                  const claimStatus = getClaimStatus(v, currentUser?.id || "");
                  const claimerName = v.hot_lead_claimed_by ? agentNameMap.get(v.hot_lead_claimed_by) : undefined;
                  const isActionable = claimStatus === "available" || claimStatus === "expired" || claimStatus === "mine";

                  return (
                    <TableRow key={v.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-sm">{v.full_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{CATEGORIES.find(c => c.key === v.category)?.label ?? v.category}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.city}</TableCell>
                      <TableCell className="text-xs">{getRespondedChannel(v)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.responded_at ? new Date(v.responded_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <ClaimStatusBadge
                          status={claimStatus}
                          agentName={claimerName}
                          claimedAt={v.hot_lead_claimed_at}
                        />
                      </TableCell>
                      <TableCell className="text-xs max-w-[140px] truncate text-muted-foreground">{v.notes || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end items-center">
                          {/* Claim / Release */}
                          {(claimStatus === "available" || claimStatus === "expired") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                              disabled={!!busy}
                              onClick={() => claimLead(v.id)}
                              title="Claim this lead"
                            >
                              {busy === `claim-${v.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Hand className="h-3 w-3 mr-1" />}
                              Claim
                            </Button>
                          )}
                          {claimStatus === "mine" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                              disabled={!!busy}
                              onClick={() => releaseLead(v.id)}
                              title="Release claim"
                            >
                              {busy === `release-${v.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Release"}
                            </Button>
                          )}

                          {/* Status Actions — only if claimed by me or available */}
                          {isActionable && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={!!busy}
                                onClick={() => copy(v.claim_link)}
                                title="Copy Claim Link"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>

                              <Select
                                onValueChange={(action) => {
                                  if (action === "converted") markConverted(v.id);
                                  else if (action === "not_interested") markNotInterested(v.id);
                                  else if (action === "maybe_later") markMaybeLater(v.id);
                                  else if (action === "revert") revertToContacted(v.id);
                                }}
                              >
                                <SelectTrigger className="h-7 w-[130px] text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 focus:ring-emerald-200">
                                  <SelectValue placeholder="Change status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="converted">
                                    <span className="flex items-center gap-1.5">
                                      <Trophy className="h-3 w-3 text-emerald-500" /> Converted
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="not_interested">
                                    <span className="flex items-center gap-1.5">
                                      <ThumbsDown className="h-3 w-3 text-red-500" /> Not Interested
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="maybe_later">
                                    <span className="flex items-center gap-1.5">
                                      <HelpCircle className="h-3 w-3 text-amber-500" /> Maybe Later
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="revert">
                                    <span className="flex items-center gap-1.5">
                                      <Undo2 className="h-3 w-3 text-orange-500" /> Revert to Queue
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          )}

                          {/* If claimed by others — show disabled state */}
                          {claimStatus === "others" && (
                            <span className="text-[10px] text-muted-foreground italic px-2">
                              Being worked on
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {filter === "all" ? "No hot leads yet" : "No leads match this filter"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4 px-2">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-end">
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
    </div>
  );
}
