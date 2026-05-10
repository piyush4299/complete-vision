import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Save, RefreshCw, Loader2, Plus, Trash2, UserCheck, UserX, Copy, Check, CloudOff } from "lucide-react";
import { generateClaimLink } from "@/lib/vendor-utils";

// ─── Auto-save hook ──────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

function useAutoSave(delay: number = 800) {
  const [status, setStatus] = useState<Record<string, SaveStatus>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const scheduleSave = useCallback((key: string, value: string) => {
    // Clear any pending timer for this key
    if (timers.current[key]) clearTimeout(timers.current[key]);
    if (savedTimers.current[key]) clearTimeout(savedTimers.current[key]);

    setStatus(prev => ({ ...prev, [key]: "saving" }));

    timers.current[key] = setTimeout(async () => {
      try {
        const now = new Date().toISOString();
        if (value === "") {
          // Delete the setting if value is empty
          await supabase.from("settings").delete().eq("key", key);
        } else {
          await supabase.from("settings").upsert(
            { key, value, updated_at: now },
            { onConflict: "key" }
          );
        }
        setStatus(prev => ({ ...prev, [key]: "saved" }));
        // Clear "saved" indicator after 2s
        savedTimers.current[key] = setTimeout(() => {
          setStatus(prev => ({ ...prev, [key]: "idle" }));
        }, 2000);
      } catch {
        setStatus(prev => ({ ...prev, [key]: "error" }));
      }
    }, delay);
  }, [delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
      Object.values(savedTimers.current).forEach(clearTimeout);
    };
  }, []);

  return { status, scheduleSave };
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 animate-fade-in">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
        <CloudOff className="h-3 w-3" /> Error
      </span>
    );
  }
  return null;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [allTemplates, setAllTemplates] = useState<any[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const [initializingTemplates, setInitializingTemplates] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { status: saveStatus, scheduleSave } = useAutoSave(800);

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", email: "", password: "" });
  const [savingAgent, setSavingAgent] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const userId = currentUser?.id || "";

  const fetchTeamMembers = async () => {
    const { data } = await supabase.from("team_members").select("*").order("created_at");
    setTeamMembers(data ?? []);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase.from("message_templates").select("*").order("channel").order("type");
    setAllTemplates(data ?? []);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: s } = await supabase.from("settings").select("*");
      const map: Record<string, string> = {};
      for (const row of s ?? []) map[row.key] = row.value;
      setSettings(map);
    };
    fetchSettings();
    fetchTemplates();
    fetchTeamMembers();
  }, []);

  // Global templates (user_id is null) — admin edits these
  const globalTemplates = useMemo(
    () => allTemplates.filter(t => !t.user_id),
    [allTemplates]
  );

  // Current user's personal templates
  const myTemplates = useMemo(
    () => allTemplates.filter(t => t.user_id === userId),
    [allTemplates, userId]
  );

  // Templates shown in the editor: user's own if they exist, otherwise global for admin
  const editableTemplates = isAdmin ? globalTemplates : myTemplates;

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    scheduleSave(key, value);
  };

  const regenerateAllClaimLinks = async () => {
    const baseUrl = settings.claim_link_base;
    if (!baseUrl) {
      toast({ title: "Set a claim link base URL first", variant: "destructive" });
      return;
    }
    setRegenerating(true);
    try {
      const { data: vendors } = await supabase.from("vendors").select("*");
      if (!vendors?.length) {
        toast({ title: "No vendors found" });
        setRegenerating(false);
        return;
      }
      const updates = vendors.map(v => {
        const name = v.full_name || v.username || "there";
        const newLink = generateClaimLink(name, v.phone, v.email, baseUrl);
        return supabase.from("vendors").update({ claim_link: newLink }).eq("id", v.id);
      });
      const results = await Promise.all(updates);
      const failed = results.filter(r => r.error);
      if (failed.length > 0) {
        toast({ title: "Some links failed", description: `${failed.length} of ${vendors.length} failed`, variant: "destructive" });
      } else {
        toast({ title: `Updated ${vendors.length} claim links` });
      }
      window.dispatchEvent(new Event("vendors-updated"));
    } catch {
      toast({ title: "Error regenerating", variant: "destructive" });
    }
    setRegenerating(false);
  };

  const updateTemplate = (id: string, field: string, value: string) => {
    setAllTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const saveTemplate = async (template: any) => {
    if (savingTemplate) return;
    setSavingTemplate(template.id);
    try {
      await supabase.from("message_templates").update({
        subject: template.subject,
        body: template.body,
        updated_at: new Date().toISOString(),
      }).eq("id", template.id);
      toast({ title: "Template saved!", duration: 1500 });
      window.dispatchEvent(new Event("vendors-updated"));
    } finally {
      setSavingTemplate(null);
    }
  };

  const initializeMyTemplates = async () => {
    if (myTemplates.length > 0) {
      toast({ title: "You already have templates", description: "Edit your existing templates below.", duration: 2000 });
      return;
    }
    setInitializingTemplates(true);
    try {
      const inserts = globalTemplates.map(t => ({
        channel: t.channel,
        type: t.type,
        subject: t.subject || "",
        body: t.body || "",
        is_active: true,
        user_id: userId,
      }));
      if (inserts.length === 0) {
        toast({ title: "No global templates to copy", variant: "destructive" });
        setInitializingTemplates(false);
        return;
      }
      const { error } = await supabase.from("message_templates").insert(inserts as any[]);
      if (error) {
        toast({ title: "Error copying templates", description: error.message, variant: "destructive" });
      } else {
        toast({ title: `Copied ${inserts.length} templates to your account` });
        await fetchTemplates();
      }
    } finally {
      setInitializingTemplates(false);
    }
  };

  // ─── Settings sections config ─────────────────────────────────────────────

  const agentSettings = [
    {
      title: "✍️ My Sender Details",
      items: [
        { key: `${userId}:sender_name`, label: "Your name (shown in messages)", type: "text" },
        { key: `${userId}:sender_phone`, label: "Your phone number", type: "text" },
        { key: `${userId}:sender_title`, label: "Your title / designation", type: "text" },
      ],
    },
    {
      title: "🛡️ My Instagram Safety",
      items: [
        { key: `${userId}:insta_account_age`, label: "Account age", type: "select", options: ["new", "warm", "aged"], optionLabels: ["New (< 2 weeks) — 15/day", "Warm (2-4 weeks) — 25/day", "Aged (> 1 month) — 40/day"] },
        { key: `${userId}:insta_last_action_block`, label: "Last action block date (leave empty if never)", type: "date" },
      ],
    },
  ];

  const adminOnlySettings = [
    {
      title: "🛡️ Instagram Safety (Global Default)",
      items: [
        { key: "insta_account_age", label: "Default account age", type: "select", options: ["new", "warm", "aged"], optionLabels: ["New (< 2 weeks) — 15/day", "Warm (2-4 weeks) — 25/day", "Aged (> 1 month) — 40/day"] },
        { key: "insta_last_action_block", label: "Default last action block date", type: "date" },
      ],
    },
    {
      title: "📊 Daily Targets",
      items: [
        { key: "instagram_daily_target", label: "Instagram DMs per day", type: "number" },
        { key: "whatsapp_daily_target", label: "WhatsApp messages per day", type: "number" },
        { key: "email_daily_target", label: "Emails per day", type: "number" },
      ],
    },
    {
      title: "⏱️ Sequence Timing",
      items: [
        { key: "days_wa_after_insta", label: "Days before WhatsApp after Instagram" },
        { key: "days_email_after_wa", label: "Days before Email after WhatsApp" },
        { key: "days_insta_followup", label: "Days before Instagram follow-up" },
        { key: "days_wa_followup", label: "Days before WhatsApp follow-up" },
        { key: "days_email_followup", label: "Days before Email follow-up" },
        { key: "days_exhausted", label: "Days before marking as Exhausted" },
        { key: "days_reengagement", label: "Days before Maybe Later re-engagement" },
      ],
    },
    {
      title: "🔗 Claim Link",
      items: [
        { key: "claim_link_base", label: "Claim link base URL", type: "text" },
      ],
    },
    {
      title: "👤 Admin Info",
      items: [
        { key: "admin_name", label: "Your name", type: "text" },
        { key: "company_name", label: "Company name", type: "text" },
      ],
    },
  ];

  const settingsConfig = isAdmin ? [...agentSettings, ...adminOnlySettings] : agentSettings;

  const channelLabel = (ch: string) => ch === "instagram" ? "📸 Instagram" : ch === "whatsapp" ? "💬 WhatsApp" : ch === "linkedin" ? "💼 LinkedIn" : "📧 Email";
  const typeLabel = (t: string) => {
    if (t.startsWith("initial_")) return `Initial #${t.split("_")[1]}`;
    if (t.startsWith("comment_")) return `Comment #${t.split("_")[1]}`;
    if (t === "comment") return "Comment";
    if (t === "followup") return "Follow-up";
    if (t === "final_followup") return "Final Follow-up";
    if (t === "re_engagement" || t === "reengagement") return "Re-engagement";
    if (t === "initial") return "Initial";
    return t;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">⚙️ {isAdmin ? "Settings" : "My Settings"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Changes are saved automatically as you type</p>
        </div>
      </div>

      {/* Settings Sections */}
      {settingsConfig.map(section => (
        <Card key={section.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {section.items.map((item: any) => (
              <div key={item.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Label className="text-sm w-full sm:w-64 sm:shrink-0 flex items-center gap-2">
                  {item.label}
                  <SaveIndicator status={saveStatus[item.key] || "idle"} />
                </Label>
                {item.type === "select" ? (
                  <Select value={settings[item.key] || item.options[0]} onValueChange={v => updateSetting(item.key, v)}>
                    <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(item.options as string[]).map((opt: string, i: number) => (
                        <SelectItem key={opt} value={opt}>{item.optionLabels?.[i] || opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={item.type === "date" ? "date" : item.type === "text" ? "text" : "number"}
                    value={settings[item.key] || ""}
                    onChange={e => updateSetting(item.key, e.target.value)}
                    className="w-full sm:w-48"
                  />
                )}
              </div>
            ))}
            {section.title.includes("Claim Link") && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  After changing the base URL, click below to update all existing vendor claim links.
                </p>
                <Button size="sm" variant="outline" onClick={regenerateAllClaimLinks} disabled={regenerating}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${regenerating ? "animate-spin" : ""}`} />
                  {regenerating ? "Regenerating..." : "Regenerate All Claim Links & Messages"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Team Members (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">👥 Team Members</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowAddAgent(v => !v)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Agent
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showAddAgent && (
              <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input placeholder="Name" value={newAgent.name} onChange={e => setNewAgent(a => ({ ...a, name: e.target.value }))} />
                  <Input placeholder="Email" type="email" value={newAgent.email} onChange={e => setNewAgent(a => ({ ...a, email: e.target.value.toLowerCase() }))} />
                  <Input placeholder="Password" type="text" value={newAgent.password} onChange={e => setNewAgent(a => ({ ...a, password: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={savingAgent || !newAgent.name || !newAgent.email || !newAgent.password} onClick={async () => {
                    setSavingAgent(true);
                    const { error } = await supabase.from("team_members").insert({
                      name: newAgent.name.trim(),
                      email: newAgent.email.trim(),
                      password: newAgent.password,
                      role: "agent",
                    });
                    if (error) {
                      toast({ title: "Error adding agent", description: error.message, variant: "destructive" });
                    } else {
                      toast({ title: "Agent added" });
                      setNewAgent({ name: "", email: "", password: "" });
                      setShowAddAgent(false);
                      fetchTeamMembers();
                    }
                    setSavingAgent(false);
                  }}>
                    {savingAgent ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />} Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowAddAgent(false); setNewAgent({ name: "", email: "", password: "" }); }}>Cancel</Button>
                </div>
              </div>
            )}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Name</th>
                    <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Email</th>
                    <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Role</th>
                    <th className="text-center px-3 py-2 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map(m => (
                    <tr key={m.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{m.name}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{m.email}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${m.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {m.is_active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><UserCheck className="h-3 w-3" /> Active</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 text-xs"><UserX className="h-3 w-3" /> Inactive</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {m.id !== currentUser?.id && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={async () => {
                              await supabase.from("team_members").update({ is_active: !m.is_active }).eq("id", m.id);
                              fetchTeamMembers();
                              toast({ title: m.is_active ? "Deactivated" : "Activated", duration: 1500 });
                            }}>
                              {m.is_active ? "Deactivate" : "Activate"}
                            </Button>
                            {m.role !== "admin" && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={async () => {
                                await supabase.from("team_members").delete().eq("id", m.id);
                                fetchTeamMembers();
                                toast({ title: "Agent removed", duration: 1500 });
                              }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Tasks are automatically divided among active agents. Each agent sees their own portion of the daily queue.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Message Templates — visible to all users */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                📝 {isAdmin ? "Message Templates (Global Defaults)" : "My Message Templates"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Placeholders: {"{name}"}, {"{category}"}, {"{city}"}, {"{claim_link}"}, {"{sender_name}"}, {"{sender_phone}"}, {"{sender_title}"}
              </p>
            </div>
            {!isAdmin && myTemplates.length === 0 && (
              <Button size="sm" variant="outline" onClick={initializeMyTemplates} disabled={initializingTemplates} className="shrink-0">
                {initializingTemplates ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {initializingTemplates ? "Copying..." : "Copy Global Templates"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAdmin && myTemplates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">You don't have personal templates yet.</p>
              <p className="text-xs mt-1">Click "Copy Global Templates" above to get started with the admin's default templates, then customize them.</p>
            </div>
          )}
          {editableTemplates.map(t => (
            <div key={t.id} className="rounded-lg border p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-sm font-medium">
                  {channelLabel(t.channel)} — {typeLabel(t.type)}
                </p>
                <Button size="sm" variant="outline" onClick={() => saveTemplate(t)} disabled={!!savingTemplate} className="w-full sm:w-auto shrink-0">
                  {savingTemplate === t.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  {savingTemplate === t.id ? "Saving..." : "Save Template"}
                </Button>
              </div>
              {t.channel === "email" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <Input
                    value={t.subject || ""}
                    onChange={e => updateTemplate(t.id, "subject", e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Body</Label>
                <Textarea
                  value={t.body || ""}
                  onChange={e => updateTemplate(t.id, "body", e.target.value)}
                  rows={t.body?.split("\n").length > 5 ? 8 : 4}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
