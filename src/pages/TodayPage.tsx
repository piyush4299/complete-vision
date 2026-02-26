import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, Flame, Send, RefreshCw,
  CheckCircle2, Clock, Zap, TrendingUp, Shield, Instagram, Phone, Mail, ChevronRight,
} from "lucide-react";
import { CATEGORIES } from "@/lib/vendor-utils";
import { StatusBadge } from "@/components/StatusBadge";
import { buildDailyPlan, type DailyPlan, type Session, type ChannelProgress } from "@/lib/daily-plan-engine";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  if (channel === "instagram") return <Instagram className={className} />;
  if (channel === "whatsapp") return <Phone className={className} />;
  if (channel === "email") return <Mail className={className} />;
  return <Send className={className} />;
}

const CHANNEL_COLORS: Record<string, { bar: string; bg: string; text: string; ring: string }> = {
  instagram: { bar: "bg-pink-500", bg: "bg-pink-50", text: "text-pink-700", ring: "ring-pink-200" },
  whatsapp:  { bar: "bg-green-500", bg: "bg-green-50", text: "text-green-700", ring: "ring-green-200" },
  email:     { bar: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  mixed:     { bar: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
};

function ChannelProgressBar({ channel, data }: { channel: string; data: ChannelProgress }) {
  const colors = CHANNEL_COLORS[channel] || CHANNEL_COLORS.email;
  const pct = Math.min(data.pct, 100);
  const label = channel === "instagram" ? "Instagram" : channel === "whatsapp" ? "WhatsApp" : "Email";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChannelIcon channel={channel} className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums font-semibold">{data.doneToday}/{data.target}</span>
          {data.safe ? (
            <Shield className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          )}
        </div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{data.remaining} remaining today</span>
        {channel === "instagram" && (
          <span>Week: {data.weeklyDone}/{data.weeklyCap}</span>
        )}
      </div>
    </div>
  );
}

function SessionCard({ session, onStart }: { session: Session; onStart: () => void }) {
  const colors = CHANNEL_COLORS[session.channel] || CHANNEL_COLORS.mixed;
  const icon = session.sessionType === "overdue" ? "🔥" :
               session.sessionType === "followup" ? "🔄" : "📤";

  return (
    <div
      className={`group rounded-xl border p-4 transition-all hover:shadow-md ${
        session.urgent ? "border-destructive/40 bg-destructive/5" : "hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{icon}</span>
            <h3 className="font-semibold text-sm">{session.label}</h3>
            {session.urgent && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive uppercase tracking-wider">
                Urgent
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{session.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{session.estimatedMinutes} min
            </span>
            <span>{session.tasks.length} vendor{session.tasks.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant={session.urgent ? "destructive" : "default"}
          className="shrink-0"
          onClick={onStart}
        >
          Start <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
        </Button>
      </div>
    </div>
  );
}

function StatBlock({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold leading-none tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
      </div>
    </div>
  );
}

export default function TodayPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const [{ data: v }, { data: seq }, { data: l }, { data: s }] = await Promise.all([
        supabase.from("vendors").select("*"),
        supabase.from("vendor_sequences").select("*"),
        supabase.from("outreach_log").select("*"),
        supabase.from("settings").select("*"),
      ]);
      setVendors(v ?? []);
      setSequences(seq ?? []);
      setLogs(l ?? []);
      const map: Record<string, string> = {};
      for (const row of s ?? []) map[row.key] = row.value;
      setSettings(map);
      setLoading(false);
    };
    load();
  }, []);

  const plan: DailyPlan | null = useMemo(() => {
    if (loading) return null;
    return buildDailyPlan(vendors, sequences, logs, settings);
  }, [vendors, sequences, logs, settings, loading]);

  if (loading || !plan) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-pulse text-muted-foreground text-sm">Loading your daily plan...</div>
      </div>
    );
  }

  const adminName = settings.admin_name || "Ankit";
  const todayDate = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const handleStartSession = (session: Session) => {
    const params = new URLSearchParams();
    if (session.channel !== "mixed") params.set("channel", session.channel);
    if (session.sessionType === "overdue") params.set("type", "overdue");
    else if (session.sessionType === "followup") params.set("type", "followup");
    else params.set("type", "outreach");
    navigate(`/outreach?${params.toString()}`);
  };

  const activeSessions = plan.sessions.filter(s => s.tasks.length > 0);
  const allDone = activeSessions.length === 0 && plan.doneToday.total > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in pb-8">

      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {adminName}!
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{todayDate}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums">{plan.overallPct}%</p>
          <p className="text-[11px] text-muted-foreground">Daily progress</p>
        </div>
      </div>

      {/* ─── Channel Progress ──────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 pb-4 space-y-4">
          <ChannelProgressBar channel="instagram" data={plan.progress.instagram} />
          <ChannelProgressBar channel="whatsapp"  data={plan.progress.whatsapp} />
          <ChannelProgressBar channel="email"     data={plan.progress.email} />
        </CardContent>
      </Card>

      {/* ─── Time-Based Recommendation ─────────────────────────────────── */}
      <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-transparent p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              Best channel right now: <span className="font-semibold">{plan.timeRecommendation.label}</span>
            </p>
            <p className="text-xs text-muted-foreground">{plan.timeRecommendation.reason}</p>
          </div>
        </div>
      </div>

      {/* ─── All Done State ────────────────────────────────────────────── */}
      {allDone && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-emerald-800">All done for today!</h2>
            <p className="text-sm text-emerald-600 mt-1">
              You sent {plan.doneToday.total} messages today. Great work!
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Sessions ──────────────────────────────────────────────────── */}
      {activeSessions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Today's Sessions
            </h2>
            <span className="text-xs text-muted-foreground">
              {plan.totalTasks} tasks &middot; ~{plan.totalEstimatedMinutes} min total
            </span>
          </div>
          {activeSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onStart={() => handleStartSession(session)}
            />
          ))}
        </div>
      )}

      {/* ─── No tasks state ────────────────────────────────────────────── */}
      {activeSessions.length === 0 && plan.doneToday.total === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Send className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-muted-foreground">No tasks scheduled</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Upload vendor data or check if sequence timing needs adjustment in Settings.
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <Button variant="outline" onClick={() => navigate("/upload")}>
                Upload Vendors
              </Button>
              <Button variant="outline" onClick={() => navigate("/settings")}>
                Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Done Today ────────────────────────────────────────────────── */}
      {plan.doneToday.total > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 text-sm">
              {plan.doneToday.instagram > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-3 py-1 text-xs font-medium text-pink-700">
                  <Instagram className="h-3 w-3" /> {plan.doneToday.instagram} DMs
                </span>
              )}
              {plan.doneToday.whatsapp > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                  <Phone className="h-3 w-3" /> {plan.doneToday.whatsapp} messages
                </span>
              )}
              {plan.doneToday.email > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  <Mail className="h-3 w-3" /> {plan.doneToday.email} emails
                </span>
              )}
              {plan.doneToday.replies > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                  💬 {plan.doneToday.replies} {plan.doneToday.replies === 1 ? "reply" : "replies"}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Performance Grid ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Performance
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Card className="col-span-2">
            <CardContent className="pt-4 pb-3">
              <div className="grid grid-cols-4 gap-4">
                <StatBlock
                  label="Yesterday"
                  value={plan.yesterday.total}
                  sub={`${plan.yesterday.insta} IG · ${plan.yesterday.wa} WA · ${plan.yesterday.email} Em`}
                  icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                />
                <StatBlock
                  label="This Week"
                  value={plan.thisWeek.total}
                  sub={`${plan.thisWeek.insta} IG · ${plan.thisWeek.wa} WA · ${plan.thisWeek.email} Em`}
                  icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                />
                <StatBlock
                  label="Replies"
                  value={plan.thisWeek.replies}
                  sub={plan.yesterday.replies > 0 ? `${plan.yesterday.replies} yesterday` : "This week"}
                  icon={<RefreshCw className="h-4 w-4 text-purple-500" />}
                />
                <StatBlock
                  label="Sign-ups"
                  value={plan.thisWeek.signups}
                  sub={plan.yesterday.signups > 0 ? `${plan.yesterday.signups} yesterday` : "This week"}
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Hot Leads ─────────────────────────────────────────────────── */}
      {plan.hotLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                Hot Leads
              </CardTitle>
              <Button variant="link" size="sm" className="px-0 h-auto text-xs shrink-0" onClick={() => navigate("/hot-leads")}>
                View all <ArrowRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {plan.hotLeads.map((v: any) => {
              const daysSince = v.responded_at
                ? Math.floor((Date.now() - new Date(v.responded_at).getTime()) / 86400000)
                : null;
              return (
                <div key={v.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div>
                    <p className="font-medium text-sm">{v.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {CATEGORIES.find(c => c.key === v.category)?.label} · {v.city}
                      {v.responded_channel && ` · via ${v.responded_channel}`}
                      {daysSince !== null && ` · ${daysSince}d ago`}
                    </p>
                  </div>
                  <StatusBadge status="interested" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ─── Instagram Safety Info ─────────────────────────────────────── */}
      <Card className="border-dashed">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Instagram safety: {plan.progress.instagram.safeLimit}/day limit
              {" · "}{plan.progress.instagram.weeklyDone}/{plan.progress.instagram.weeklyCap} this week
              {plan.progress.instagram.safe
                ? " · Status: Safe"
                : " · ⚠️ Approaching limit"
              }
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
