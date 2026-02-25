import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponseActions } from "@/components/ResponseActions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Copy, ExternalLink, CheckCircle2, Clock, Circle, MessageCircle, Link2, Check, Pencil, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CATEGORIES, generateClaimLink, generateInstaMessage, generateWhatsAppMessage, generateEmailSubject, generateEmailBody } from "@/lib/vendor-utils";
import { SEQUENCE_LABELS, type SequenceStep, type SequenceType } from "@/lib/sequence-utils";

interface VendorTimelineProps {
  vendorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function VendorTimeline({ vendorId, open, onOpenChange, onUpdate }: VendorTimelineProps) {
  const [vendor, setVendor] = useState<any>(null);
  const [sequence, setSequence] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const { toast } = useToast();

  const fetchData = async () => {
    if (!vendorId) return;
    const [{ data: v }, { data: seq }, { data: logData }] = await Promise.all([
      supabase.from("vendors").select("*").eq("id", vendorId).single(),
      supabase.from("vendor_sequences").select("*").eq("vendor_id", vendorId).maybeSingle(),
      supabase.from("outreach_log").select("*").eq("vendor_id", vendorId).order("created_at", { ascending: true }),
    ]);
    setVendor(v);
    setSequence(seq);
    setLogs(logData ?? []);
  };

  useEffect(() => {
    if (open && vendorId) fetchData();
  }, [open, vendorId]);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({ username: "", phone: "", email: "" });

  const startEditing = () => {
    setEditFields({
      username: vendor?.username || "",
      phone: vendor?.phone || "",
      email: vendor?.email || "",
    });
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const saveEdits = async () => {
    if (!vendor) return;
    const u = editFields.username.replace(/^@/, "").trim().toLowerCase() || null;
    const p = editFields.phone.replace(/[\s\-\(\)\+]/g, "").replace(/^91/, "").trim() || null;
    const e = editFields.email.trim().toLowerCase() || null;

    const updates: Record<string, any> = {
      username: u,
      phone: p,
      email: e,
      has_instagram: !!u,
      has_phone: !!p,
      has_email: !!e,
      profile_url: u ? `https://www.instagram.com/${u}/` : "",
    };

    const { data: settingsRows } = await supabase.from("settings").select("*").eq("key", "claim_link_base").maybeSingle();
    const claimBase = settingsRows?.value || undefined;
    const name = vendor.full_name;
    updates.claim_link = generateClaimLink(name, p || "", e || "", claimBase);
    updates.insta_message = u ? generateInstaMessage(name, vendor.category, vendor.city, updates.claim_link, 0) : null;
    updates.whatsapp_message = p ? generateWhatsAppMessage(name, vendor.category, vendor.city, updates.claim_link, 0) : null;
    updates.email_subject = e ? generateEmailSubject(name, vendor.category, 0) : null;
    updates.email_body = e ? generateEmailBody(name, vendor.category, vendor.city, updates.claim_link) : null;

    await supabase.from("vendors").update(updates).eq("id", vendor.id);
    toast({ title: "Vendor updated", duration: 1500 });
    setEditing(false);
    fetchData();
    onUpdate?.();
    window.dispatchEvent(new Event("vendors-updated"));
  };

  const copy = (text: string, field?: string) => {
    navigator.clipboard.writeText(text);
    if (field) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
    toast({ title: "Copied!", duration: 1500 });
  };

  const saveNote = async () => {
    if (!vendor || !newNote.trim()) return;
    const existing = vendor.notes || "";
    const timestamp = new Date().toLocaleDateString();
    const updated = existing ? `${existing}\n\n[${timestamp}] ${newNote}` : `[${timestamp}] ${newNote}`;
    await supabase.from("vendors").update({ notes: updated }).eq("id", vendor.id);
    toast({ title: "Note saved" });
    setNewNote("");
    fetchData();
    onUpdate?.();
  };

  if (!vendor) return null;

  const steps: SequenceStep[] = sequence?.steps ? (sequence.steps as any as SequenceStep[]) : [];
  const startedAt = sequence?.started_at ? new Date(sequence.started_at) : null;

  const channelIcon = (ch: string) => ch === "instagram" ? "📸" : ch === "whatsapp" ? "💬" : ch === "email" ? "📧" : "⏹️";

  // Build timeline entries from logs + sequence steps
  const timelineEntries: { date: string; icon: string; label: string; status: "done" | "current" | "future" | "response"; channel?: string }[] = [];

  for (const log of logs) {
    const actionLabel = log.action === "sent" ? "Initial message sent" : log.action === "followed_up" ? "Follow-up sent" : log.action === "skipped" ? "Skipped" : log.action;
    timelineEntries.push({
      date: new Date(log.created_at).toLocaleDateString(),
      icon: channelIcon(log.channel),
      label: `${actionLabel} via ${log.channel}`,
      status: "done",
      channel: log.channel,
    });
  }

  if (vendor.responded_at) {
    timelineEntries.push({
      date: new Date(vendor.responded_at).toLocaleDateString(),
      icon: "💬",
      label: `Responded on ${vendor.responded_channel || "unknown"}: ${vendor.notes?.split("\n")[0] || ""}`,
      status: "response",
    });
  }

  // Add future steps from sequence
  if (startedAt && steps.length > 0) {
    const currentStep = sequence?.current_step ?? 0;
    for (let i = currentStep; i < steps.length; i++) {
      const step = steps[i];
      if (step.channel === "exhausted") continue;
      const stepDate = new Date(startedAt.getTime() + step.day * 86400000);
      const isNext = i === currentStep;
      timelineEntries.push({
        date: stepDate.toLocaleDateString(),
        icon: channelIcon(step.channel),
        label: `${step.type === "initial" ? "Initial message" : "Follow-up"} via ${step.channel}`,
        status: isNext ? "current" : "future",
        channel: step.channel,
      });
    }
  }

  // Sort by date
  timelineEntries.sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return -1;
    if (a.status !== "done" && b.status === "done") return 1;
    return 0;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-auto">
        <SheetHeader>
          <SheetTitle className="text-left">Vendor Details</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Vendor Info */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold">{vendor.full_name}</h2>
            <p className="text-sm text-muted-foreground">
              {CATEGORIES.find(c => c.key === vendor.category)?.label} • {vendor.city}
            </p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={vendor.overall_status || "pending"} />
              {sequence && (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                  {SEQUENCE_LABELS[sequence.sequence_type as SequenceType] || sequence.sequence_type}
                </span>
              )}
            </div>

            {/* Contact info */}
            <div className="space-y-1.5 text-sm">
              {editing ? (
                <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="text-sm w-5 shrink-0">📸</span>
                    <Input value={editFields.username} onChange={e => setEditFields(f => ({ ...f, username: e.target.value }))} placeholder="Instagram handle" className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm w-5 shrink-0">💬</span>
                    <Input value={editFields.phone} onChange={e => setEditFields(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm w-5 shrink-0">📧</span>
                    <Input value={editFields.email} onChange={e => setEditFields(f => ({ ...f, email: e.target.value }))} placeholder="Email address" className="h-8 text-sm" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={saveEdits} className="h-7 text-xs"><Save className="h-3 w-3 mr-1" /> Save</Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-7 text-xs"><X className="h-3 w-3 mr-1" /> Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      {vendor.username && (
                        <a href={vendor.profile_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline truncate">
                          📸 @{vendor.username} <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      )}
                      {vendor.phone && (
                        <a href={`https://wa.me/91${vendor.phone}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                          💬 {vendor.phone} <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      )}
                      {vendor.email && (
                        <a href={`mailto:${vendor.email}`} className="flex items-center gap-2 text-primary hover:underline truncate">
                          📧 {vendor.email} <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={startEditing} title="Edit contact info">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}

              {vendor.claim_link && (
                <div className="rounded-lg border bg-gradient-to-r from-emerald-50/60 to-transparent p-2.5 mt-1 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Link2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-700">Claim Link</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono truncate mb-2" title={vendor.claim_link}>
                    {vendor.claim_link}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => copy(vendor.claim_link, "claim")}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition-colors"
                    >
                      {copiedField === "claim" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedField === "claim" ? "Copied!" : "Copy Link"}
                    </button>
                    <a
                      href={vendor.claim_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-muted hover:bg-muted/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" /> Open
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Response Actions */}
            <div className="pt-2 flex flex-wrap gap-1">
              <ResponseActions vendorId={vendor.id} currentStatus={vendor.overall_status} onUpdate={() => { fetchData(); onUpdate?.(); }} />
            </div>
          </div>

          {/* Contact Timeline */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Contact Timeline</h3>
            {timelineEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No activity yet</p>
            ) : (
              <div className="relative space-y-0">
                {/* Vertical line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                {timelineEntries.map((entry, i) => (
                  <div key={i} className="flex gap-3 py-2 relative">
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center relative z-10">
                      {entry.status === "done" && <CheckCircle2 className="h-4 w-4 text-status-sent" />}
                      {entry.status === "current" && <div className="h-3.5 w-3.5 rounded-full bg-blue-500 ring-2 ring-blue-200" />}
                      {entry.status === "future" && <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                      {entry.status === "response" && <MessageCircle className="h-4 w-4 text-purple-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${entry.status === "current" ? "font-medium text-blue-600" : entry.status === "future" ? "text-muted-foreground" : entry.status === "response" ? "text-purple-600 font-medium" : ""}`}>
                        {entry.icon} {entry.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.status === "current" ? `Scheduled for ${entry.date}` : entry.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            {vendor.notes && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap mb-3 max-h-40 overflow-auto">
                {vendor.notes}
              </div>
            )}
            <Textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              rows={2}
              className="mb-2"
            />
            <Button onClick={saveNote} size="sm" disabled={!newNote.trim()}>
              Save Note
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
