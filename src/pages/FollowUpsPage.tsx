import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Calendar, Clock, RefreshCw, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES } from "@/lib/vendor-utils";
import { REENGAGEMENT_MESSAGE } from "@/lib/sequence-utils";
import { useToast } from "@/hooks/use-toast";

const EXCLUDED_STATUSES = ["interested", "not_interested", "declined", "converted", "maybe_later", "invalid"];

interface FollowUpVendor {
  id: string;
  full_name: string;
  category: string;
  city: string;
  claim_link: string;
  channel: "instagram" | "whatsapp" | "email";
  contacted_at: string;
  due_date: string;
  days_overdue: number;
}

function getFollowUpDays(channel: string): number {
  if (channel === "instagram") return 5;
  if (channel === "whatsapp") return 3;
  return 4;
}

export default function FollowUpsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("vendors").select("*");
      setVendors(data ?? []);
    };
    fetch();
  }, []);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const allFollowUps = useMemo(() => {
    const results: FollowUpVendor[] = [];
    for (const v of vendors) {
      if (EXCLUDED_STATUSES.includes(v.overall_status)) continue;

      const checks: { channel: "instagram" | "whatsapp" | "email"; has: boolean; status: string; contactedAt: string | null }[] = [
        { channel: "instagram", has: v.has_instagram, status: v.insta_status, contactedAt: v.insta_contacted_at },
        { channel: "whatsapp", has: v.has_phone, status: v.whatsapp_status, contactedAt: v.whatsapp_contacted_at },
        { channel: "email", has: v.has_email, status: v.email_status, contactedAt: v.email_contacted_at },
      ];

      for (const ch of checks) {
        if (!ch.has || ch.status !== "sent" || !ch.contactedAt) continue;
        const days = getFollowUpDays(ch.channel);
        const contactedDate = new Date(ch.contactedAt);
        const dueDate = new Date(contactedDate.getTime() + days * 86400000);
        const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const daysOverdue = Math.floor((today.getTime() - dueDay.getTime()) / 86400000);

        results.push({
          id: v.id,
          full_name: v.full_name,
          category: v.category,
          city: v.city,
          claim_link: v.claim_link,
          channel: ch.channel,
          contacted_at: ch.contactedAt,
          due_date: dueDate.toISOString(),
          days_overdue: daysOverdue,
        });
      }
    }
    return results;
  }, [vendors]);

  const dueToday = useMemo(() => allFollowUps.filter(f => f.days_overdue === 0), [allFollowUps]);
  const overdue = useMemo(() => allFollowUps.filter(f => f.days_overdue > 0), [allFollowUps]);

  const upcoming = useMemo(() => {
    const future = allFollowUps.filter(f => f.days_overdue < 0 && f.days_overdue >= -7);
    const byDate: Record<string, FollowUpVendor[]> = {};
    for (const f of future) {
      const key = new Date(f.due_date).toLocaleDateString();
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(f);
    }
    return Object.entries(byDate).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());
  }, [allFollowUps]);

  // Re-engagement: maybe_later > 30 days ago
  const reengagement = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000);
    return vendors.filter(v => (v.overall_status === "not_interested" || v.overall_status === "maybe_later") && v.responded_at && new Date(v.responded_at) < cutoff);
  }, [vendors]);

  const groupByChannel = (items: FollowUpVendor[]) => {
    const groups: Record<string, FollowUpVendor[]> = { instagram: [], whatsapp: [], email: [] };
    for (const item of items) {
      groups[item.channel].push(item);
    }
    return groups;
  };

  const channelIcon = (ch: string) => ch === "instagram" ? "📸" : ch === "whatsapp" ? "💬" : "📧";
  const channelLabel = (ch: string) => ch === "instagram" ? "Instagram" : ch === "whatsapp" ? "WhatsApp" : "Email";

  const startFollowUpSession = (channel: string) => {
    // Navigate to outreach page — user can start follow-up session there
    navigate("/outreach");
  };

  const copyReengagement = (v: any) => {
    const catLabel = CATEGORIES.find(c => c.key === v.category)?.label.toLowerCase() ?? v.category;
    const msg = REENGAGEMENT_MESSAGE(v.full_name, catLabel, v.claim_link);
    navigator.clipboard.writeText(msg);
    toast({ title: "Re-engagement message copied!", duration: 1500 });
  };

  const totalDueToday = dueToday.length;
  const totalOverdue = overdue.length;
  const dueTodayGroups = groupByChannel(dueToday);
  const overdueGroups = groupByChannel(overdue);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">🔄 Follow-ups</h1>
        <p className="text-muted-foreground mt-1">
          {totalDueToday + totalOverdue} follow-ups need attention
        </p>
      </div>

      {/* Section 1: Due Today */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Due Today ({totalDueToday})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {totalDueToday === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No follow-ups due today 🎉</p>
          ) : (
            Object.entries(dueTodayGroups).filter(([, items]) => items.length > 0).map(([ch, items]) => (
              <div key={ch} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{channelIcon(ch)}</span>
                  <div>
                    <p className="font-medium text-sm">{channelLabel(ch)}</p>
                    <p className="text-xs text-muted-foreground">{items.length} vendor{items.length !== 1 ? "s" : ""} ready</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => startFollowUpSession(ch)}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Start Session
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Section 2: Upcoming */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Upcoming (Next 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No upcoming follow-ups</p>
          ) : (
            upcoming.map(([date, items]) => {
              const channels = groupByChannel(items);
              const breakdown = Object.entries(channels)
                .filter(([, arr]) => arr.length > 0)
                .map(([ch, arr]) => `${channelIcon(ch)} ${arr.length}`)
                .join("  ");
              return (
                <div key={date} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-sm">{date}</p>
                    <p className="text-xs text-muted-foreground">{items.length} follow-up{items.length !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-sm">{breakdown}</p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Section 3: Overdue */}
      {totalOverdue > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Overdue ({totalOverdue})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(overdueGroups).filter(([, items]) => items.length > 0).map(([ch, items]) => (
              <div key={ch} className="flex items-center justify-between rounded-lg border border-destructive/20 p-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{channelIcon(ch)}</span>
                  <div>
                    <p className="font-medium text-sm">{channelLabel(ch)}</p>
                    <p className="text-xs text-muted-foreground">{items.length} overdue</p>
                  </div>
                </div>
                <Button size="sm" variant="destructive" onClick={() => startFollowUpSession(ch)}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Start Session
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 4: Re-engagement Queue */}
      {reengagement.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-orange-500" /> Re-engagement Queue ({reengagement.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Vendors who said "maybe later" more than 30 days ago
            </p>
            {reengagement.map(v => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium text-sm">{v.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORIES.find(c => c.key === v.category)?.label} • {v.city} • Responded {v.responded_at ? new Date(v.responded_at).toLocaleDateString() : "—"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyReengagement(v)}>
                  Copy Message
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
