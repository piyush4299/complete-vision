import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponseActions } from "@/components/ResponseActions";
import {
  Copy, ExternalLink, CheckCircle2, SkipForward, StopCircle, Send,
  Pause, Play, Trash2, ChevronDown, ChevronRight, Instagram, Phone,
  Mail, Clock, Zap, Undo2, Link2, Check, Loader2, Pencil, Save, X, Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  CATEGORIES,
  applyTemplatePlaceholders,
  stableVendorHash,
  type SenderInfo,
} from "@/lib/vendor-utils";
import { buildDailyPlan, type DailyPlan, type DailyTask } from "@/lib/daily-plan-engine";

type Channel = "instagram" | "whatsapp" | "email";

interface PausedSession {
  id: string;
  channel: Channel;
  is_follow_up: boolean;
  vendor_ids: string[];
  current_index: number;
  sent_count: number;
  skipped_count: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CH_LABEL: Record<string, string> = { instagram: "Instagram", whatsapp: "WhatsApp", email: "Email" };
const CH_SHORT: Record<string, string> = { instagram: "IG", whatsapp: "WA", email: "Em" };

function ChannelPill({ channel }: { channel: string }) {
  const colors: Record<string, string> = {
    instagram: "bg-pink-100 text-pink-700",
    whatsapp: "bg-green-100 text-green-700",
    email: "bg-blue-100 text-blue-700",
  };
  const icons: Record<string, React.ReactNode> = {
    instagram: <Instagram className="h-3 w-3" />,
    whatsapp: <Phone className="h-3 w-3" />,
    email: <Mail className="h-3 w-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors[channel] || ""}`}>
      {icons[channel]} {CH_LABEL[channel]}
    </span>
  );
}

function SequenceStepper({ task, vendor }: { task: DailyTask; vendor: any }) {
  const channelDots = task.availableChannels;
  const statusMap: Record<string, string> = {};
  if (vendor) {
    if (vendor.has_instagram) statusMap.instagram = vendor.insta_status || "pending";
    if (vendor.has_phone) statusMap.whatsapp = vendor.whatsapp_status || "pending";
    if (vendor.has_email) statusMap.email = vendor.email_status || "pending";
  }

  return (
    <div className="flex items-center gap-0.5">
      {channelDots.map((ch, i) => {
        const status = statusMap[ch] || "pending";
        const isCurrent = ch === task.channel;
        const isDone = status === "sent" || status === "followed_up" || status === "skipped";

        let dotClass = "h-2 w-2 rounded-full ";
        if (isCurrent) dotClass += "ring-2 ring-offset-1 ";
        if (isDone) dotClass += ch === "instagram" ? "bg-pink-500" : ch === "whatsapp" ? "bg-green-500" : "bg-blue-500";
        else if (isCurrent) dotClass += ch === "instagram" ? "bg-pink-400 ring-pink-300" : ch === "whatsapp" ? "bg-green-400 ring-green-300" : "bg-blue-400 ring-blue-300";
        else dotClass += "bg-gray-200";

        return (
          <div key={ch} className="flex items-center">
            <div className={dotClass} title={`${CH_LABEL[ch]}: ${status}`} />
            {i < channelDots.length - 1 && <div className="w-2 h-px bg-gray-200 mx-0.5" />}
          </div>
        );
      })}
    </div>
  );
}

function getActionLink(vendor: any, channel: Channel, message: string, subject: string): string {
  if (channel === "instagram") return vendor.profile_url || "";
  if (channel === "whatsapp") return `https://wa.me/91${vendor.phone}?text=${encodeURIComponent(message)}`;
  if (channel === "email") return `mailto:${vendor.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  return "";
}

function openLink(link: string) {
  if (!link) return;
  if (link.startsWith("mailto:")) {
    window.location.href = link;
  } else {
    window.open(link, "_blank", "noopener,noreferrer");
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OutreachPage() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [vendors, setVendors] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [messageTemplates, setMessageTemplates] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"queue" | "done">("queue");
  const [channelFilter, setChannelFilter] = useState<"all" | Channel>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "overdue" | "followup" | "initial">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [sessionActive, setSessionActive] = useState(false);
  const [sessionVendors, setSessionVendors] = useState<{ task: DailyTask; vendor: any }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [summary, setSummary] = useState<{ sent: number; skipped: number; remaining: number } | null>(null);
  const [pausedSession, setPausedSession] = useState<PausedSession | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchData = async () => {
    const [{ data: v }, { data: seq }, { data: l }, { data: s }, { data: mt }, { data: tm }] = await Promise.all([
      supabase.from("vendors").select("*"),
      supabase.from("vendor_sequences").select("*"),
      supabase.from("outreach_log").select("*"),
      supabase.from("settings").select("*"),
      supabase.from("message_templates").select("*").eq("is_active", true),
      supabase.from("team_members").select("*").eq("is_active", true),
    ]);
    setVendors(v ?? []);
    setSequences(seq ?? []);
    setLogs(l ?? []);
    setMessageTemplates(mt ?? []);
    setTeamMembers(tm ?? []);
    const map: Record<string, string> = {};
    for (const row of s ?? []) map[row.key] = row.value;
    setSettings(map);
    setLoading(false);
  };

  const fetchPausedSession = async () => {
    const { data } = await supabase.from("paused_sessions").select("*").order("created_at", { ascending: false }).limit(1);
    setPausedSession(data && data.length > 0 ? (data[0] as any) : null);
  };

  useEffect(() => {
    fetchData(); fetchPausedSession();
    const handler = () => { fetchData(); fetchPausedSession(); };
    window.addEventListener("vendors-updated", handler);
    return () => window.removeEventListener("vendors-updated", handler);
  }, []);

  useEffect(() => {
    const ch = searchParams.get("channel");
    const type = searchParams.get("type");
    if (ch && ["instagram", "whatsapp", "email"].includes(ch)) setChannelFilter(ch as Channel);
    if (type === "overdue") setTypeFilter("overdue");
    else if (type === "followup") setTypeFilter("followup");
    else if (type === "outreach") setTypeFilter("initial");
  }, [searchParams]);

  const plan: DailyPlan | null = useMemo(() => {
    if (loading || !currentUser) return null;
    const sortedAgents = [...teamMembers].sort((a, b) => a.id.localeCompare(b.id));
    const agentIndex = sortedAgents.findIndex(a => a.id === currentUser.id);
    const idx = agentIndex >= 0 ? agentIndex : 0;
    return buildDailyPlan(vendors, sequences, logs, settings, currentUser.id, sortedAgents.length || 1, idx);
  }, [vendors, sequences, logs, settings, loading, currentUser, teamMembers]);

  const vendorMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const v of vendors) m.set(v.id, v);
    return m;
  }, [vendors]);

  const queueTasks = useMemo(() => {
    if (!plan) return [];
    let tasks = plan.plannedTasks;
    if (channelFilter !== "all") tasks = tasks.filter(t => t.channel === channelFilter);
    if (typeFilter === "overdue") tasks = tasks.filter(t => t.isOverdue);
    else if (typeFilter === "followup") tasks = tasks.filter(t => t.type === "followup" && !t.isOverdue);
    else if (typeFilter === "initial") tasks = tasks.filter(t => t.type === "initial");
    return tasks;
  }, [plan, channelFilter, typeFilter]);

  const templateMap = useMemo(() => {
    // Prefer user-specific templates; fall back to global (user_id null) per channel:type
    const userTemplates = messageTemplates.filter(t => t.user_id === currentUser?.id);
    const globalTemplates = messageTemplates.filter(t => !t.user_id);

    const buildMap = (list: any[]) => {
      const m: Record<string, any[]> = {};
      for (const t of list) {
        const groupKey = t.type.startsWith("initial_") ? "initial" : t.type;
        const key = `${t.channel}:${groupKey}`;
        if (!m[key]) m[key] = [];
        m[key].push(t);
      }
      for (const key of Object.keys(m)) {
        m[key].sort((a: any, b: any) => a.type.localeCompare(b.type));
      }
      return m;
    };

    // If user has any personal templates, use those entirely; otherwise use global
    return userTemplates.length > 0 ? buildMap(userTemplates) : buildMap(globalTemplates);
  }, [messageTemplates, currentUser]);

  const senderInfo: SenderInfo = useMemo(() => {
    const uid = currentUser?.id || "";
    return {
      name: settings[`${uid}:sender_name`] || settings.admin_name || currentUser?.name || "",
      phone: settings[`${uid}:sender_phone`] || "",
      title: settings[`${uid}:sender_title`] || "",
    };
  }, [settings, currentUser]);

  const getVendorMessage = useCallback((vendor: any, channel: Channel, isFollowUp: boolean): string => {
    const typeKey = isFollowUp ? "followup" : "initial";
    const templates = templateMap[`${channel}:${typeKey}`];
    if (templates?.length) {
      const idx = isFollowUp ? 0 : stableVendorHash(vendor.id) % templates.length;
      return applyTemplatePlaceholders(templates[idx].body, vendor, senderInfo);
    }
    if (channel === "instagram") return vendor.insta_message || "";
    if (channel === "whatsapp") return vendor.whatsapp_message || "";
    if (channel === "email") return vendor.email_body || "";
    return "";
  }, [templateMap, senderInfo]);

  const getVendorSubject = useCallback((vendor: any, isFollowUp: boolean): string => {
    const typeKey = isFollowUp ? "followup" : "initial";
    const templates = templateMap[`email:${typeKey}`];
    if (templates?.length) {
      const idx = isFollowUp ? 0 : stableVendorHash(vendor.id) % templates.length;
      return templates[idx].subject ? applyTemplatePlaceholders(templates[idx].subject, vendor, senderInfo) : "";
    }
    return vendor.email_subject || "";
  }, [templateMap, senderInfo]);

  const doneTodayList = useMemo(() => {
    const today = new Date().toDateString();
    return logs
      .filter(l => new Date(l.created_at).toDateString() === today && (l.action === "sent" || l.action === "followed_up" || l.action === "skipped"))
      .map(l => ({ log: l, vendor: vendorMap.get(l.vendor_id) }))
      .filter(x => x.vendor)
      .sort((a, b) => new Date(b.log.created_at).getTime() - new Date(a.log.created_at).getTime());
  }, [logs, vendorMap]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: "Copied!", duration: 1200 }));
  }, [toast]);

  const markSent = async (task: DailyTask) => {
    if (actionInProgress) return;
    setActionInProgress(`sent-${task.vendorId}`);
    try {
      const vendor = vendorMap.get(task.vendorId);
      if (!vendor) return;
      const statusField = task.channel === "instagram" ? "insta_status" : task.channel === "whatsapp" ? "whatsapp_status" : "email_status";
      const contactedField = task.channel === "instagram" ? "insta_contacted_at" : task.channel === "whatsapp" ? "whatsapp_contacted_at" : "email_contacted_at";
      const newStatus = task.type === "followup" ? "followed_up" : "sent";

      await supabase.from("vendors").update({
        [statusField]: newStatus,
        [contactedField]: new Date().toISOString(),
        overall_status: (!vendor.overall_status || vendor.overall_status === "pending") ? "in_progress" : vendor.overall_status,
      }).eq("id", vendor.id);

      await supabase.from("outreach_log").insert({
        vendor_id: vendor.id, channel: task.channel, action: newStatus,
        message_sent: getVendorMessage(vendor, task.channel, task.type === "followup"),
        user_id: currentUser?.id || null,
      });

      const seq = sequences.find(s => s.vendor_id === vendor.id && s.is_active);
      if (seq) {
        await supabase.from("vendor_sequences").update({
          current_step: seq.current_step + 1,
        }).eq("id", seq.id);
      }

      toast({ title: `Marked as ${newStatus}`, duration: 1200 });
      setExpandedId(null);
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  const markSkipped = async (task: DailyTask) => {
    if (actionInProgress) return;
    setActionInProgress(`skip-${task.vendorId}`);
    try {
      const vendor = vendorMap.get(task.vendorId);
      if (!vendor) return;
      // Only log the skip — don't change vendor status or advance sequence.
      // The vendor will reappear in tomorrow's queue.
      await supabase.from("outreach_log").insert({ vendor_id: vendor.id, channel: task.channel, action: "skipped", user_id: currentUser?.id || null });

      toast({ title: "Skipped — will reappear tomorrow", duration: 1500 });
      setExpandedId(null);
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  const revertSent = async (logEntry: any) => {
    if (actionInProgress) return;
    setActionInProgress(`revert-${logEntry.id}`);
    try {
      const vendor = vendorMap.get(logEntry.vendor_id);
      if (!vendor) return;
      const ch = logEntry.channel as Channel;
      const statusField = ch === "instagram" ? "insta_status" : ch === "whatsapp" ? "whatsapp_status" : "email_status";
      const contactedField = ch === "instagram" ? "insta_contacted_at" : ch === "whatsapp" ? "whatsapp_contacted_at" : "email_contacted_at";

      const revertTo = logEntry.action === "followed_up" ? "sent" : "pending";
      const updates: Record<string, any> = { [statusField]: revertTo };
      if (revertTo === "pending") updates[contactedField] = null;

      const EXCLUDED_STATUSES = ["interested", "not_interested", "declined", "converted", "maybe_later", "invalid"];
      if (EXCLUDED_STATUSES.includes(vendor.overall_status)) {
        updates.overall_status = "in_progress";
        updates.responded_at = null;
        updates.responded_channel = null;
      }

      await supabase.from("vendors").update(updates).eq("id", vendor.id);
      await supabase.from("outreach_log").delete().eq("id", logEntry.id);

      const seq = sequences.find(s => s.vendor_id === vendor.id && s.is_active);
      if (seq && seq.current_step > 0) {
        await supabase.from("vendor_sequences").update({
          current_step: seq.current_step - 1,
        }).eq("id", seq.id);
      }

      toast({ title: `Reverted to ${revertTo}`, duration: 1500 });
      setExpandedId(null);
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  // ─── Inline Vendor Edit ──────────────────────────────────────────────────

  const startEditing = (vendor: any) => {
    setEditingVendorId(vendor.id);
    setEditForm({
      full_name: vendor.full_name || "",
      username: vendor.username || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      website: vendor.website || "",
      claim_link: vendor.claim_link || "",
      category: vendor.category || "uncategorized",
      city: vendor.city || "",
    });
  };

  const cancelEditing = () => {
    setEditingVendorId(null);
    setEditForm({});
  };

  const saveVendorEdit = async (vendorId: string) => {
    if (actionInProgress) return;
    setActionInProgress(`edit-${vendorId}`);
    try {
      const username = editForm.username?.trim() || null;
      const phone = editForm.phone?.trim() || null;
      const email = editForm.email?.trim() || null;
      const fullName = editForm.full_name?.trim() || "";

      const updates: Record<string, any> = {
        full_name: fullName,
        username,
        phone,
        email,
        website: editForm.website?.trim() || null,
        claim_link: editForm.claim_link?.trim() || "",
        category: editForm.category || "uncategorized",
        city: editForm.city?.trim() || "",
        has_instagram: !!username,
        has_phone: !!phone,
        has_email: !!email,
        profile_url: username ? `https://www.instagram.com/${username.replace(/^@/, "")}/` : "",
      };

      const { error } = await supabase.from("vendors").update(updates).eq("id", vendorId);
      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive", duration: 4000 });
        return;
      }
      toast({ title: "Vendor updated", duration: 1500 });
      setEditingVendorId(null);
      setEditForm({});
      await fetchData();

      // Refresh session vendor data if editing during a focused session
      if (sessionActive) {
        const { data: freshVendor } = await supabase.from("vendors").select("*").eq("id", vendorId).single();
        if (freshVendor) {
          setSessionVendors(prev => prev.map(sv => sv.vendor.id === vendorId ? { ...sv, vendor: freshVendor } : sv));
        }
      }

      window.dispatchEvent(new Event("vendors-updated"));
    } finally {
      setActionInProgress(null);
    }
  };

  // ─── Focused Session ─────────────────────────────────────────────────────

  const startFocusedSession = () => {
    const items = queueTasks.map(t => ({ task: t, vendor: vendorMap.get(t.vendorId)! })).filter(x => x.vendor);
    if (items.length === 0) { toast({ title: "No vendors in queue" }); return; }
    setSessionVendors(items);
    setCurrentIndex(0); setSentCount(0); setSkippedCount(0); setStreak(0); setSummary(null);
    sessionStartRef.current = Date.now();
    setSessionActive(true);
  };

  const currentSession = sessionActive && currentIndex < sessionVendors.length ? sessionVendors[currentIndex] : null;

  const endSession = () => {
    setSummary({ sent: sentCount, skipped: skippedCount, remaining: sessionVendors.length - currentIndex });
    setSessionActive(false);
    fetchData();
  };

  const pauseSession = async () => {
    if (!currentSession) return;
    await supabase.from("paused_sessions").insert({
      channel: sessionVendors[0]?.task.channel || "instagram",
      is_follow_up: sessionVendors[0]?.task.type === "followup",
      vendor_ids: sessionVendors.map(sv => sv.vendor.id),
      current_index: currentIndex, sent_count: sentCount, skipped_count: skippedCount,
      filter_cat: "all", filter_city: "all", batch_size: sessionVendors.length,
    } as any);
    toast({ title: "Session paused" });
    setSessionActive(false);
    fetchPausedSession(); fetchData();
  };

  const resumePausedSession = async () => {
    if (!pausedSession) return;
    const { data } = await supabase.from("vendors").select("*").in("id", pausedSession.vendor_ids);
    if (!data?.length) { toast({ title: "Vendors no longer available" }); await supabase.from("paused_sessions").delete().eq("id", pausedSession.id); setPausedSession(null); return; }
    const ordered = pausedSession.vendor_ids.map(id => data.find(v => v.id === id)).filter(Boolean).map(v => ({
      task: { vendorId: v!.id, vendorName: v!.full_name, category: v!.category, city: v!.city, channel: pausedSession.channel, type: pausedSession.is_follow_up ? "followup" as const : "initial" as const, priority: 0, isOverdue: false, daysOverdue: 0, identifier: "", sequenceLabel: "", stepNumber: 0, totalSteps: 0, availableChannels: [] as Channel[] },
      vendor: v!,
    }));
    setSessionVendors(ordered); setCurrentIndex(pausedSession.current_index); setSentCount(pausedSession.sent_count); setSkippedCount(pausedSession.skipped_count); setStreak(0); setSummary(null);
    sessionStartRef.current = Date.now(); setSessionActive(true);
    await supabase.from("paused_sessions").delete().eq("id", pausedSession.id); setPausedSession(null);
  };

  const handleSessionSent = async () => {
    if (!currentSession || actionInProgress) return;
    await markSent(currentSession.task);
    setSentCount(c => c + 1); setStreak(s => s + 1);
    if (currentIndex + 1 >= sessionVendors.length) endSession();
    else setCurrentIndex(i => i + 1);
  };

  const handleSessionSkip = async () => {
    if (!currentSession || actionInProgress) return;
    await markSkipped(currentSession.task);
    setSkippedCount(c => c + 1); setStreak(0);
    if (currentIndex + 1 >= sessionVendors.length) endSession();
    else setCurrentIndex(i => i + 1);
  };

  const handleSessionOpen = () => {
    if (!currentSession) return;
    const { task, vendor } = currentSession;
    const msg = getVendorMessage(vendor, task.channel, task.type === "followup");
    const subj = task.channel === "email" ? getVendorSubject(vendor, task.type === "followup") : "";
    const link = getActionLink(vendor, task.channel, msg, subj);
    copyToClipboard(msg);
    if (link) openLink(link);
  };

  useEffect(() => {
    if (currentSession) copyToClipboard(getVendorMessage(currentSession.vendor, currentSession.task.channel, currentSession.task.type === "followup"));
  }, [currentIndex, sessionActive]);

  useEffect(() => {
    if (!sessionActive || !currentSession) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); handleSessionSent(); }
      else if (k === "k") { e.preventDefault(); handleSessionSkip(); }
      else if (k === "o") { e.preventDefault(); handleSessionOpen(); }
      else if (k === "c") { e.preventDefault(); copyToClipboard(getVendorMessage(currentSession.vendor, currentSession.task.channel, currentSession.task.type === "followup")); }
      else if (k === "escape") { e.preventDefault(); endSession(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sessionActive, currentSession, currentIndex]);

  const getETA = () => {
    const done = sentCount + skippedCount;
    if (done === 0) return "—";
    const remaining = sessionVendors.length - currentIndex;
    return `~${Math.ceil(((Date.now() - sessionStartRef.current) / 1000 / done) * remaining / 60)}m`;
  };

  // ─── Render: Loading ─────────────────────────────────────────────────────

  if (loading || !plan) return <div className="flex items-center justify-center py-32"><div className="animate-pulse text-muted-foreground text-sm">Loading...</div></div>;

  // ─── Render: Summary ─────────────────────────────────────────────────────

  if (summary) return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <Card><CardContent className="pt-6 space-y-4">
        <div className="text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
          <h2 className="text-xl font-bold">Session Complete!</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border p-3"><p className="text-2xl font-bold text-emerald-600">{summary.sent}</p><p className="text-xs text-muted-foreground">Sent</p></div>
          <div className="rounded-lg border p-3"><p className="text-2xl font-bold text-muted-foreground">{summary.skipped}</p><p className="text-xs text-muted-foreground">Skipped</p></div>
          <div className="rounded-lg border p-3"><p className="text-2xl font-bold">{summary.remaining}</p><p className="text-xs text-muted-foreground">Remaining</p></div>
        </div>
        <Button onClick={() => { setSummary(null); fetchData(); }} className="w-full">Back to Queue</Button>
      </CardContent></Card>
    </div>
  );

  // ─── Render: Focused Session ─────────────────────────────────────────────

  if (sessionActive && currentSession) {
    const { task, vendor } = currentSession;
    const message = getVendorMessage(vendor, task.channel, task.type === "followup");
    const subject = task.channel === "email" ? getVendorSubject(vendor, task.type === "followup") : "";
    const progress = ((currentIndex + 1) / sessionVendors.length) * 100;

    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChannelPill channel={task.channel} />
            <h1 className="text-xl font-bold">{task.type === "followup" ? "Follow-up" : "Outreach"}</h1>
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">{currentIndex + 1} / {sessionVendors.length}</span>
        </div>

        <Card className="border-2">
          <CardContent className="pt-6 space-y-5">

            {/* Vendor Header + Edit Toggle */}
            {editingVendorId === vendor.id ? (
              <div className="rounded-lg border p-3 space-y-2.5 bg-amber-50/30 border-amber-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-700">Edit Vendor Details</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-amber-200" disabled={!!actionInProgress} onClick={cancelEditing}>
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white" disabled={!!actionInProgress} onClick={() => saveVendorEdit(vendor.id)}>
                      {actionInProgress === `edit-${vendor.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Save
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Business Name</label>
                    <Input className="h-8 text-xs mt-0.5" value={editForm.full_name || ""} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Full business name" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Category</label>
                    <Select value={editForm.category || "uncategorized"} onValueChange={v => setEditForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Instagram className="h-3 w-3 text-pink-500" /> Instagram</label>
                    <Input className="h-8 text-xs mt-0.5 font-mono" value={editForm.username || ""} onChange={e => setEditForm(f => ({ ...f, username: e.target.value.replace(/^@/, "") }))} placeholder="username" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3 text-green-500" /> Phone</label>
                    <Input className="h-8 text-xs mt-0.5 font-mono" value={editForm.phone || ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3 text-blue-500" /> Email</label>
                    <Input className="h-8 text-xs mt-0.5 font-mono" value={editForm.email || ""} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="Email address" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3 text-gray-500" /> Website</label>
                    <Input className="h-8 text-xs mt-0.5 font-mono" value={editForm.website || ""} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} placeholder="Website URL" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Link2 className="h-3 w-3 text-emerald-600" /> Claim Link</label>
                    <Input className="h-8 text-xs mt-0.5 font-mono" value={editForm.claim_link || ""} onChange={e => setEditForm(f => ({ ...f, claim_link: e.target.value }))} placeholder="Claim link URL" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">City</label>
                    <Input className="h-8 text-xs mt-0.5" value={editForm.city || ""} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold">{vendor.full_name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{CATEGORIES.find(c => c.key === vendor.category)?.label} · {vendor.city}</p>
                    <p className="text-sm font-mono text-muted-foreground mt-0.5">{task.identifier}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0" onClick={() => startEditing(vendor)}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                </div>
                {vendor.website && (
                  <a href={vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1.5">
                    <Globe className="h-3 w-3 text-gray-500" /> {vendor.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            )}

            {task.sequenceLabel && (
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">Journey:</span>
                <span className="text-xs font-medium">{task.sequenceLabel}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-medium">Step {task.stepNumber}/{task.totalSteps}</span>
                <SequenceStepper task={task} vendor={vendor} />
              </div>
            )}

            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="flex flex-wrap gap-3 text-xs">
                {vendor.has_instagram && <div className="flex items-center gap-1.5"><Instagram className="h-3 w-3 text-pink-500" /><StatusBadge status={vendor.insta_status} /><span className="font-mono text-muted-foreground">@{vendor.username}</span>{task.channel === "instagram" && <span className="text-xs font-medium text-primary">(now)</span>}</div>}
                {vendor.has_phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-green-500" /><StatusBadge status={vendor.whatsapp_status} /><span className="font-mono text-muted-foreground">{vendor.phone}</span>{task.channel === "whatsapp" && <span className="text-xs font-medium text-primary">(now)</span>}</div>}
                {vendor.has_email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-blue-500" /><StatusBadge status={vendor.email_status} /><span className="font-mono text-muted-foreground truncate max-w-[180px]">{vendor.email}</span>{task.channel === "email" && <span className="text-xs font-medium text-primary">(now)</span>}</div>}
              </div>
            </div>

            {/* Claim Link */}
            {vendor.claim_link && (
              <div className="rounded-lg border bg-gradient-to-r from-emerald-50/60 to-transparent p-3 overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    <Link2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700">Claim Link</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => copyToClipboard(vendor.claim_link)}>
                      <Copy className="h-3 w-3 mr-1.5" /> Copy Link
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(vendor.claim_link, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="h-3 w-3 mr-1.5" /> Test Link
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono truncate mt-1.5" title={vendor.claim_link}>{vendor.claim_link}</p>
              </div>
            )}

            {task.channel === "email" && <div className="rounded-lg border p-3 bg-muted/30"><p className="text-xs font-medium text-muted-foreground mb-0.5">Subject</p><p className="text-sm">{subject}</p></div>}

            <div className="rounded-lg border p-4 bg-muted/50 overflow-hidden"><p className="text-sm leading-relaxed whitespace-pre-wrap break-all">{message}</p></div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              {task.channel === "email" && <Button variant="secondary" size="sm" className="flex-1 sm:size-default" onClick={() => copyToClipboard(subject)}><Copy className="h-3.5 w-3.5 mr-1.5" /> Subject</Button>}
              <Button variant="secondary" size="sm" className="flex-1 sm:size-default" onClick={() => copyToClipboard(message)}><Copy className="h-3.5 w-3.5 mr-1.5" /> Message</Button>
              <Button variant="secondary" size="sm" className="flex-1 sm:size-default" onClick={handleSessionOpen}><ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open</Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <Button onClick={handleSessionSent} disabled={!!actionInProgress} className="h-11 sm:h-12 bg-emerald-600 hover:bg-emerald-700 text-white">
                {actionInProgress?.startsWith("sent-") ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />} Sent
              </Button>
              <Button onClick={handleSessionSkip} disabled={!!actionInProgress} variant="secondary" className="h-11 sm:h-12">
                {actionInProgress?.startsWith("skip-") ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <SkipForward className="h-4 w-4 mr-1.5" />} Skip
              </Button>
              <Button onClick={pauseSession} disabled={!!actionInProgress} variant="outline" className="h-11 sm:h-12"><Pause className="h-4 w-4 mr-1.5" /> Pause</Button>
              <Button onClick={endSession} disabled={!!actionInProgress} variant="destructive" className="h-11 sm:h-12"><StopCircle className="h-4 w-4 mr-1.5" /> Stop</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Progress value={progress} className="h-3" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="tabular-nums">{currentIndex + 1}/{sessionVendors.length} · Sent: {sentCount} · Skipped: {skippedCount}</span>
            <div className="flex items-center gap-4">{streak > 1 && <span>🔥 {streak}</span>}<span>ETA: {getETA()}</span></div>
          </div>
        </div>
        <div className="hidden sm:block rounded-lg border bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">S</kbd> Sent <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono ml-2">K</kbd> Skip <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono ml-2">O</kbd> Open <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono ml-2">C</kbd> Copy <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono ml-2">Esc</kbd> Stop
        </div>
      </div>
    );
  }

  // ─── Render: Queue + Done Today ──────────────────────────────────────────

  const totalTarget = plan.progress.instagram.target + plan.progress.whatsapp.target + plan.progress.email.target;
  const overallPct = totalTarget > 0 ? Math.round((plan.doneToday.total / totalTarget) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in pb-8">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Outreach</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            {plan.doneToday.total}/{totalTarget} done today · {queueTasks.length} in queue
          </p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-right">
            <p className="text-xl sm:text-2xl font-bold tabular-nums">{overallPct}%</p>
            <p className="text-[10px] text-muted-foreground">Progress</p>
          </div>
          {queueTasks.length > 0 && activeTab === "queue" && (
            <Button size="sm" className="sm:size-default" onClick={startFocusedSession}><Zap className="h-4 w-4 mr-1 sm:mr-2" /> Focused Session</Button>
          )}
        </div>
      </div>

      {/* ─── Paused Session ─────────────────────────────────────────────── */}
      {pausedSession && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Paused {pausedSession.is_follow_up ? "follow-up" : "outreach"} ({CH_LABEL[pausedSession.channel]})</p>
            <p className="text-xs text-muted-foreground">{pausedSession.current_index}/{(pausedSession.vendor_ids as string[]).length} done · {pausedSession.sent_count} sent</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={resumePausedSession} size="sm"><Play className="h-3.5 w-3.5 mr-1" /> Resume</Button>
            <Button onClick={async () => { await supabase.from("paused_sessions").delete().eq("id", pausedSession.id); setPausedSession(null); toast({ title: "Discarded" }); }} variant="outline" size="sm"><Trash2 className="h-3.5 w-3.5 mr-1" /> Discard</Button>
          </div>
        </div>
      )}

      {/* ─── Mini Progress ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {(["instagram", "whatsapp", "email"] as Channel[]).map(ch => {
          const p = plan.progress[ch];
          const pct = Math.min(p.pct, 100);
          const barColor = ch === "instagram" ? "bg-pink-500" : ch === "whatsapp" ? "bg-green-500" : "bg-blue-500";
          return (
            <div key={ch} className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">{CH_LABEL[ch]}</span>
                <span className="text-xs tabular-nums font-semibold">{p.doneToday}/{p.target}</span>
              </div>
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── How It Works Guide ─────────────────────────────────────────── */}
      <div className="hidden sm:block rounded-xl border bg-gradient-to-r from-blue-50/50 to-transparent p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">HOW IT WORKS</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each vendor follows a <strong>drip sequence</strong> — channels are contacted one at a time with gaps between them.
          A vendor with IG + WA + Email gets: <span className="font-medium">IG first → WA after 3 days → Email after 5 days → then follow-ups</span>.
          Only the <strong>current step</strong> appears in your queue. The dots <span className="inline-flex items-center gap-0.5 mx-0.5"><span className="h-2 w-2 rounded-full bg-pink-500 inline-block" /><span className="h-2 w-2 rounded-full bg-gray-200 inline-block" /><span className="h-2 w-2 rounded-full bg-gray-200 inline-block" /></span> show journey progress.
        </p>
      </div>

      {/* ─── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b">
        <button onClick={() => setActiveTab("queue")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "queue" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          Queue ({queueTasks.length})
        </button>
        <button onClick={() => setActiveTab("done")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "done" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          Done Today ({doneTodayList.length})
        </button>
      </div>

      {/* ─── Queue Tab ──────────────────────────────────────────────────── */}
      {activeTab === "queue" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {(["all", "instagram", "whatsapp", "email"] as const).map(f => (
              <button key={f} onClick={() => setChannelFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${channelFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {f === "all" ? "All Channels" : CH_LABEL[f]}
              </button>
            ))}
            <div className="w-px h-6 bg-border self-center mx-1 shrink-0" />
            {(["all", "overdue", "followup", "initial"] as const).map(f => (
              <button key={f} onClick={() => setTypeFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${typeFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {f === "all" ? "All Types" : f === "overdue" ? "Overdue" : f === "followup" ? "Follow-ups" : "New Outreach"}
              </button>
            ))}
          </div>

          {queueTasks.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">
                {channelFilter !== "all" || typeFilter !== "all" ? "No tasks match these filters" : "Queue is empty — all done for today!"}
              </p>
              {channelFilter !== "all" && channelFilter !== "instagram" && (
                <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
                  {channelFilter === "email" ? "Email tasks appear after earlier channels (IG/WA) in the drip sequence are completed. Complete those steps first." : "WhatsApp tasks appear when it's their turn in the drip sequence."}
                </p>
              )}
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {queueTasks.map(task => {
                const vendor = vendorMap.get(task.vendorId);
                if (!vendor) return null;
                const isExpanded = expandedId === task.vendorId;
                const message = getVendorMessage(vendor, task.channel, task.type === "followup");
                const subject = task.channel === "email" ? getVendorSubject(vendor, task.type === "followup") : "";
                const link = getActionLink(vendor, task.channel, message, subject);

                return (
                  <div key={task.vendorId} className={`rounded-xl border transition-all ${task.isOverdue ? "border-red-200 bg-red-50/30" : "hover:border-primary/20 hover:shadow-sm"} ${isExpanded ? "shadow-sm" : ""}`}>
                    {/* Row */}
                    <div className="px-3 sm:px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : task.vendorId)}>
                      {/* Desktop row */}
                      <div className="hidden md:grid items-center gap-3" style={{ gridTemplateColumns: "20px 1fr 100px 80px 140px 136px" }}>
                        <div className="text-muted-foreground">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate">{task.vendorName}</p>
                            <SequenceStepper task={task} vendor={vendor} />
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {CATEGORIES.find(c => c.key === task.category)?.label} · {task.city}
                            {task.sequenceLabel && ` · ${task.sequenceLabel}`}
                            {task.totalSteps > 0 && ` · Step ${task.stepNumber}/${task.totalSteps}`}
                          </p>
                        </div>
                        <div><ChannelPill channel={task.channel} /></div>
                        <div>
                          {task.isOverdue ? (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Overdue{task.daysOverdue > 0 && ` +${task.daysOverdue}d`}</span>
                          ) : task.type === "followup" ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Follow-up</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">New</span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground truncate">{task.identifier}</div>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Copy" disabled={!!actionInProgress} onClick={() => copyToClipboard(message)}><Copy className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Open" disabled={!!actionInProgress} onClick={() => { copyToClipboard(message); if (link) openLink(link); }}><ExternalLink className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="Sent" disabled={!!actionInProgress} onClick={() => markSent(task)}>
                            {actionInProgress === `sent-${task.vendorId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Skip" disabled={!!actionInProgress} onClick={() => markSkipped(task)}>
                            {actionInProgress === `skip-${task.vendorId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SkipForward className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                      {/* Mobile card */}
                      <div className="md:hidden space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm truncate">{task.vendorName}</p>
                              <SequenceStepper task={task} vendor={vendor} />
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {CATEGORIES.find(c => c.key === task.category)?.label} · {task.city}
                            </p>
                          </div>
                          <div className="text-muted-foreground shrink-0">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <ChannelPill channel={task.channel} />
                            {task.isOverdue ? (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Overdue{task.daysOverdue > 0 && ` +${task.daysOverdue}d`}</span>
                            ) : task.type === "followup" ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Follow-up</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">New</span>
                            )}
                            <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[120px]">{task.identifier}</span>
                          </div>
                          <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Copy" disabled={!!actionInProgress} onClick={() => copyToClipboard(message)}><Copy className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Open" disabled={!!actionInProgress} onClick={() => { copyToClipboard(message); if (link) openLink(link); }}><ExternalLink className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Sent" disabled={!!actionInProgress} onClick={() => markSent(task)}>
                              {actionInProgress === `sent-${task.vendorId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Skip" disabled={!!actionInProgress} onClick={() => markSkipped(task)}>
                              {actionInProgress === `skip-${task.vendorId}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <SkipForward className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t animate-fade-in">
                        <div className="max-w-2xl mx-auto space-y-3 pt-3">

                          {/* Vendor Details — editable */}
                          {editingVendorId === vendor.id ? (
                            <div className="rounded-lg border p-3 space-y-2.5 bg-amber-50/30 border-amber-200">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-amber-700">Edit Vendor Details</p>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-200" disabled={!!actionInProgress} onClick={cancelEditing}>
                                    <X className="h-3 w-3 mr-1" /> Cancel
                                  </Button>
                                  <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white" disabled={!!actionInProgress} onClick={() => saveVendorEdit(vendor.id)}>
                                    {actionInProgress === `edit-${vendor.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Save
                                  </Button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-medium text-muted-foreground">Business Name</label>
                                  <Input className="h-8 text-xs mt-0.5" value={editForm.full_name || ""} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Full business name" />
                                </div>
                                <div>
                                  <label className="text-[10px] font-medium text-muted-foreground">Category</label>
                                  <Select value={editForm.category || "uncategorized"} onValueChange={v => setEditForm(f => ({ ...f, category: v }))}>
                                    <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Instagram className="h-3 w-3 text-pink-500" /> Instagram</label>
                                  <Input className="h-8 text-xs mt-0.5 font-mono" value={editForm.username || ""} onChange={e => setEditForm(f => ({ ...f, username: e.target.value.replace(/^@/, "") }))} placeholder="username" />
                                </div>
                                <div>
                                  <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3 text-green-500" /> Phone</label>
                                  <Input className="h-8 text-xs mt-0.5 font-mono" value={editForm.phone || ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
                                </div>
                                <div>
                                  <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3 text-blue-500" /> Email</label>
                                  <Input className="h-8 text-xs mt-0.5 font-mono" value={editForm.email || ""} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="Email address" />
                                </div>
                                <div>
                                  <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3 text-gray-500" /> Website</label>
                                  <Input className="h-8 text-xs mt-0.5 font-mono" value={editForm.website || ""} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} placeholder="Website URL" />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Link2 className="h-3 w-3 text-emerald-600" /> Claim Link</label>
                                  <Input className="h-8 text-xs mt-0.5 font-mono" value={editForm.claim_link || ""} onChange={e => setEditForm(f => ({ ...f, claim_link: e.target.value }))} placeholder="Claim link URL" />
                                </div>
                                <div>
                                  <label className="text-[10px] font-medium text-muted-foreground">City</label>
                                  <Input className="h-8 text-xs mt-0.5" value={editForm.city || ""} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-wrap gap-2 text-xs">
                                  {vendor.has_instagram && (
                                    <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 bg-background">
                                      <Instagram className="h-3 w-3 text-pink-500" /> <StatusBadge status={vendor.insta_status} />
                                      <span className="font-mono text-muted-foreground">@{vendor.username}</span>
                                    </div>
                                  )}
                                  {vendor.has_phone && (
                                    <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 bg-background">
                                      <Phone className="h-3 w-3 text-green-500" /> <StatusBadge status={vendor.whatsapp_status} />
                                      <span className="font-mono text-muted-foreground">{vendor.phone}</span>
                                    </div>
                                  )}
                                  {vendor.has_email && (
                                    <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 bg-background">
                                      <Mail className="h-3 w-3 text-blue-500" /> <StatusBadge status={vendor.email_status} />
                                      <span className="font-mono text-muted-foreground truncate max-w-[150px]">{vendor.email}</span>
                                    </div>
                                  )}
                                  {vendor.website && (
                                    <a href={vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 bg-background text-primary hover:underline">
                                      <Globe className="h-3 w-3 text-gray-500" /> <span className="truncate max-w-[120px]">{vendor.website.replace(/^https?:\/\//, "")}</span>
                                    </a>
                                  )}
                                </div>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0" onClick={() => startEditing(vendor)}>
                                  <Pencil className="h-3 w-3 mr-1" /> Edit
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Claim Link */}
                          {vendor.claim_link && (
                            <div className="rounded-lg border bg-gradient-to-r from-emerald-50/60 to-transparent p-2.5 overflow-hidden">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <Link2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                  <span className="text-[11px] font-semibold text-emerald-700 shrink-0">Claim Link</span>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-emerald-700 hover:bg-emerald-100" onClick={() => copyToClipboard(vendor.claim_link)}>
                                    <Copy className="h-3 w-3 mr-1" /> Copy
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => window.open(vendor.claim_link, "_blank", "noopener,noreferrer")}>
                                    <ExternalLink className="h-3 w-3 mr-1" /> Open
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Email subject */}
                          {task.channel === "email" && <div className="rounded-lg border p-2.5 bg-muted/30"><p className="text-[10px] font-medium text-muted-foreground mb-0.5">Subject</p><p className="text-xs">{subject}</p></div>}

                          {/* Message */}
                          <div className="rounded-lg border p-3 bg-muted/30 overflow-hidden"><p className="text-xs leading-relaxed whitespace-pre-wrap break-all">{message}</p></div>

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2">
                            {task.channel === "email" && <Button size="sm" variant="outline" onClick={() => copyToClipboard(subject)}><Copy className="h-3 w-3 mr-1.5" /> Copy Subject</Button>}
                            <Button size="sm" variant="outline" onClick={() => copyToClipboard(message)}><Copy className="h-3 w-3 mr-1.5" /> Copy Message</Button>
                            <Button size="sm" variant="outline" onClick={() => { copyToClipboard(message); if (link) openLink(link); }}><ExternalLink className="h-3 w-3 mr-1.5" /> Open {CH_LABEL[task.channel]}</Button>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!!actionInProgress} onClick={() => markSent(task)}>
                              {actionInProgress === `sent-${task.vendorId}` ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1.5" />} Mark Sent
                            </Button>
                            <Button size="sm" variant="secondary" disabled={!!actionInProgress} onClick={() => markSkipped(task)}>
                              {actionInProgress === `skip-${task.vendorId}` ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <SkipForward className="h-3 w-3 mr-1.5" />} Skip
                            </Button>
                            <Button size="sm" variant="ghost" className="text-gray-400 hover:text-red-500 hover:bg-red-50" disabled={!!actionInProgress} onClick={async () => { if (actionInProgress) return; setActionInProgress(`remove-${vendor.id}`); try { await supabase.from("vendors").update({ overall_status: "invalid" }).eq("id", vendor.id); toast({ title: "Vendor removed", duration: 1500 }); setExpandedId(null); fetchData(); window.dispatchEvent(new Event("vendors-updated")); } finally { setActionInProgress(null); } }} title="Not a valid vendor"><Trash2 className="h-3 w-3 mr-1.5" /> Remove</Button>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Done Today Tab ─────────────────────────────────────────────── */}
      {activeTab === "done" && (
        <div className="space-y-2">
          {doneTodayList.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <Send className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No outreach done yet today</p>
            </CardContent></Card>
          ) : doneTodayList.map(({ log, vendor }) => {
            const isExpanded = expandedId === `done-${log.id}`;
            const time = new Date(log.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
            const actionLabel = log.action === "sent" ? "Sent" : log.action === "followed_up" ? "Followed Up" : "Skipped";
            const actionColor = log.action === "skipped" ? "bg-gray-100 text-gray-600" : "bg-emerald-100 text-emerald-700";

            return (
              <div key={log.id} className={`rounded-xl border transition-all hover:border-primary/20 ${isExpanded ? "shadow-sm" : ""}`}>
                <div className="px-3 sm:px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : `done-${log.id}`)}>
                  {/* Desktop row */}
                  <div className="hidden md:grid items-center gap-3" style={{ gridTemplateColumns: "20px 48px 1fr 100px 80px 80px 32px" }}>
                    <div className="text-muted-foreground">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{time}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{vendor.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{CATEGORIES.find(c => c.key === vendor.category)?.label} · {vendor.city}</p>
                    </div>
                    <div><ChannelPill channel={log.channel} /></div>
                    <div><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionColor}`}>{actionLabel}</span></div>
                    <div>
                      {["interested", "not_interested", "maybe_later", "declined"].includes(vendor.overall_status) ? <StatusBadge status={vendor.overall_status} /> : <span className="text-[10px] text-muted-foreground">Awaiting</span>}
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-50" title="Revert" disabled={!!actionInProgress} onClick={() => revertSent(log)}>
                        {actionInProgress === `revert-${log.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  {/* Mobile card */}
                  <div className="md:hidden space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{vendor.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{CATEGORIES.find(c => c.key === vendor.category)?.label} · {vendor.city}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-500" title="Revert" disabled={!!actionInProgress} onClick={() => revertSent(log)}>
                          {actionInProgress === `revert-${log.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-muted-foreground tabular-nums">{time}</span>
                      <ChannelPill channel={log.channel} />
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionColor}`}>{actionLabel}</span>
                      {["interested", "not_interested", "maybe_later", "declined"].includes(vendor.overall_status) ? <StatusBadge status={vendor.overall_status} /> : <span className="text-[10px] text-muted-foreground">Awaiting</span>}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t animate-fade-in">
                    <div className="max-w-2xl mx-auto space-y-3 pt-3">
                      {log.message_sent && <div className="rounded-lg border p-3 bg-muted/30 overflow-hidden"><p className="text-[10px] font-medium text-muted-foreground mb-1">Message sent</p><p className="text-xs leading-relaxed whitespace-pre-wrap break-all">{log.message_sent}</p></div>}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" disabled={!!actionInProgress} onClick={() => revertSent(log)}>
                          {actionInProgress === `revert-${log.id}` ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Undo2 className="h-3 w-3 mr-1.5" />} Revert to Queue
                        </Button>
                      </div>
                      <div className="border-t pt-2"><p className="text-[10px] font-medium text-muted-foreground mb-1.5">Update Response</p><ResponseActions vendorId={vendor.id} currentStatus={vendor.overall_status} channel={log.channel} onUpdate={() => { setExpandedId(null); fetchData(); }} /></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
