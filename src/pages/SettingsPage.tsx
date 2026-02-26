import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, RefreshCw, Loader2 } from "lucide-react";
import { generateClaimLink } from "@/lib/vendor-utils";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const [{ data: s }, { data: t }] = await Promise.all([
        supabase.from("settings").select("*"),
        supabase.from("message_templates").select("*").order("channel").order("type"),
      ]);
      const map: Record<string, string> = {};
      for (const row of s ?? []) map[row.key] = row.value;
      setSettings(map);
      setTemplates(t ?? []);
    };
    fetch();
  }, []);

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSetting = async (key: string) => {
    const value = settings[key];
    if (!value) return;
    await supabase.from("settings").upsert({ key, value, updated_at: new Date().toISOString() } as any, { onConflict: "key" });
    toast({ title: "Saved!", duration: 1500 });
  };

  const saveSectionSettings = async (sectionTitle: string, keys: string[]) => {
    setSavingSection(sectionTitle);
    const now = new Date().toISOString();
    const rows = keys
      .filter(key => settings[key] !== undefined && settings[key] !== "")
      .map(key => ({ key, value: settings[key], updated_at: now }));
    if (rows.length > 0) {
      await supabase.from("settings").upsert(rows as any[], { onConflict: "key" });
    }
    toast({ title: `${sectionTitle.replace(/^[^\w]+/, "").trim()} saved!`, duration: 1500 });
    setSavingSection(null);
  };

  const saveAllSettings = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const rows = Object.entries(settings)
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([key, value]) => ({ key, value, updated_at: now }));
    if (rows.length > 0) {
      await supabase.from("settings").upsert(rows as any[], { onConflict: "key" });
    }
    toast({ title: "All settings saved!" });
    setSaving(false);
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
        setRegenerating(false);
        return;
      }

      toast({ title: `Updated ${vendors.length} claim links` });
      window.dispatchEvent(new Event("vendors-updated"));
    } catch (err) {
      toast({ title: "Error regenerating", variant: "destructive" });
    }
    setRegenerating(false);
  };

  const updateTemplate = (id: string, field: string, value: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
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

  const settingsConfig = [
    {
      title: "🛡️ Instagram Safety",
      items: [
        { key: "insta_account_age", label: "Account age", type: "select", options: ["new", "warm", "aged"], optionLabels: ["New (< 2 weeks) — 15/day", "Warm (2-4 weeks) — 25/day", "Aged (> 1 month) — 40/day"] },
        { key: "insta_last_action_block", label: "Last action block date (leave empty if never)", type: "date" },
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

  const channelLabel = (ch: string) => ch === "instagram" ? "📸 Instagram" : ch === "whatsapp" ? "💬 WhatsApp" : "📧 Email";
  const typeLabel = (t: string) => {
    if (t.startsWith("initial_")) return `Initial #${t.split("_")[1]}`;
    if (t === "followup") return "Follow-up";
    if (t === "reengagement") return "Re-engagement";
    return t;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">⚙️ Settings</h1>
        <Button onClick={saveAllSettings} disabled={saving} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>

      {/* Settings Sections */}
      {settingsConfig.map(section => {
        const sectionKeys = section.items.map((item: any) => item.key);
        const isSavingThis = savingSection === section.title;
        return (
          <Card key={section.title}>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-base">{section.title}</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveSectionSettings(section.title, sectionKeys)}
                  disabled={isSavingThis}
                  className="w-full sm:w-auto shrink-0"
                >
                  <Save className="h-3.5 w-3.5 mr-1" /> {isSavingThis ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.items.map((item: any) => (
                <div key={item.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <Label className="text-sm w-full sm:w-64 sm:shrink-0">{item.label}</Label>
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
                    After changing the base URL, click below to update all existing vendor claim links and regenerate their messages.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={regenerateAllClaimLinks}
                    disabled={regenerating}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${regenerating ? "animate-spin" : ""}`} />
                    {regenerating ? "Regenerating..." : "Regenerate All Claim Links & Messages"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Message Templates */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">📝 Message Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.map(t => (
            <div key={t.id} className="rounded-lg border p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-sm font-medium">
                  {channelLabel(t.channel)} — {typeLabel(t.type)}
                </p>
                <Button size="sm" variant="outline" onClick={() => saveTemplate(t)} disabled={!!savingTemplate} className="w-full sm:w-auto shrink-0">
                  {savingTemplate === t.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  {savingTemplate === t.id ? "Updating..." : "Save"}
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
                <Label className="text-xs text-muted-foreground">
                  Body <span className="text-muted-foreground/50">(use {"{name}"}, {"{category}"}, {"{city}"}, {"{claim_link}"})</span>
                </Label>
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
