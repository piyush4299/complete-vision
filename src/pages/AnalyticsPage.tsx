import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATEGORIES } from "@/lib/vendor-utils";
import { Users, UserCheck, TrendingUp, Clock } from "lucide-react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer } from "recharts";

export default function AnalyticsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: v }, { data: l }] = await Promise.all([
        supabase.from("vendors").select("*"),
        supabase.from("outreach_log").select("*"),
      ]);
      setVendors(v ?? []);
      setLogs(l ?? []);
    };
    fetch();
  }, []);

  // Funnel
  const funnel = useMemo(() => {
    const activeVendors = vendors.filter(v => v.overall_status !== "invalid");
    const total = activeVendors.length;
    const contacted = activeVendors.filter(v => v.overall_status !== "pending").length;
    const replied = activeVendors.filter(v => ["interested", "not_interested", "maybe_later", "converted"].includes(v.overall_status)).length;
    const interested = activeVendors.filter(v => ["interested", "converted"].includes(v.overall_status)).length;
    const converted = activeVendors.filter(v => v.overall_status === "converted").length;
    return [
      { label: "Uploaded", value: total },
      { label: "Contacted", value: contacted, pct: total ? ((contacted / total) * 100).toFixed(1) : "0" },
      { label: "Replied", value: replied, pct: contacted ? ((replied / contacted) * 100).toFixed(1) : "0" },
      { label: "Interested", value: interested, pct: replied ? ((interested / replied) * 100).toFixed(1) : "0" },
      { label: "Converted", value: converted, pct: interested ? ((converted / interested) * 100).toFixed(1) : "0" },
    ];
  }, [vendors]);

  // Channel performance
  const channelPerf = useMemo(() => {
    const channels = ["instagram", "whatsapp", "email"] as const;
    const fieldMap = {
      instagram: { has: "has_instagram", status: "insta_status", responded: "responded_channel" },
      whatsapp: { has: "has_phone", status: "whatsapp_status", responded: "responded_channel" },
      email: { has: "has_email", status: "email_status", responded: "responded_channel" },
    };
    const valid = vendors.filter(v => v.overall_status !== "invalid");
    return channels.map(ch => {
      const f = fieldMap[ch];
      const eligible = valid.filter(v => v[f.has]).length;
      const contacted = valid.filter(v => v[f.has] && ["sent", "followed_up"].includes(v[f.status])).length;
      const replies = valid.filter(v => v.responded_channel === ch && ["interested", "not_interested", "maybe_later", "converted"].includes(v.overall_status)).length;
      const conversions = valid.filter(v => v.responded_channel === ch && v.overall_status === "converted").length;
      return {
        channel: ch === "instagram" ? "Instagram" : ch === "whatsapp" ? "WhatsApp" : "Email",
        eligible,
        contacted,
        replyRate: contacted ? ((replies / contacted) * 100).toFixed(1) : "0",
        conversionRate: contacted ? ((conversions / contacted) * 100).toFixed(1) : "0",
      };
    });
  }, [vendors]);

  // Category performance
  const categoryData = useMemo(() => {
    return CATEGORIES.map(cat => {
      const catVendors = vendors.filter(v => v.category === cat.key);
      const total = catVendors.length;
      const contacted = catVendors.filter(v => v.overall_status !== "pending").length;
      const converted = catVendors.filter(v => v.overall_status === "converted").length;
      return { name: cat.label, total, contacted, converted };
    }).filter(c => c.total > 0);
  }, [vendors]);

  // Weekly activity (last 30 days)
  const weeklyData = useMemo(() => {
    const days: Record<string, { instagram: number; whatsapp: number; email: number }> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      days[key] = { instagram: 0, whatsapp: 0, email: 0 };
    }
    for (const log of logs) {
      if (log.action !== "sent") continue;
      const d = new Date(log.created_at);
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diff > 29) continue;
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (days[key] && (log.channel === "instagram" || log.channel === "whatsapp" || log.channel === "email")) {
        days[key][log.channel as "instagram" | "whatsapp" | "email"]++;
      }
    }
    return Object.entries(days).map(([date, counts]) => ({ date, ...counts }));
  }, [logs]);

  // Top stats
  const topStats = useMemo(() => {
    const total = vendors.length;
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const contactedThisWeek = logs.filter(l => l.action === "sent" && new Date(l.created_at) >= monday).length;
    const converted = vendors.filter(v => v.overall_status === "converted").length;
    const contacted = vendors.filter(v => v.overall_status !== "pending").length;
    const convRate = contacted ? ((converted / contacted) * 100).toFixed(1) : "0";

    // Avg response time
    const respondedVendors = vendors.filter(v => v.responded_at && v.date_contacted);
    let avgDays = 0;
    if (respondedVendors.length > 0) {
      const totalDays = respondedVendors.reduce((sum, v) => {
        const diff = (new Date(v.responded_at).getTime() - new Date(v.date_contacted || v.insta_contacted_at || v.whatsapp_contacted_at || v.email_contacted_at || v.responded_at).getTime()) / 86400000;
        return sum + Math.max(0, diff);
      }, 0);
      avgDays = Math.round((totalDays / respondedVendors.length) * 10) / 10;
    }

    return [
      { label: "Total Vendors", value: total.toString(), icon: Users },
      { label: "Contacted This Week", value: contactedThisWeek.toString(), icon: UserCheck },
      { label: "Conversion Rate", value: `${convRate}%`, icon: TrendingUp },
      { label: "Avg Response Time", value: avgDays ? `${avgDays}d` : "—", icon: Clock },
    ];
  }, [vendors, logs]);

  const chartConfig = {
    instagram: { label: "Instagram", color: "hsl(var(--chart-1))" },
    whatsapp: { label: "WhatsApp", color: "hsl(var(--chart-2))" },
    email: { label: "Email", color: "hsl(var(--chart-3))" },
    total: { label: "Total", color: "hsl(var(--chart-1))" },
    contacted: { label: "Contacted", color: "hsl(var(--chart-2))" },
    converted: { label: "Converted", color: "hsl(var(--chart-3))" },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">📊 Analytics</h1>

      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-3">
        {topStats.map(s => (
          <Card key={s.label}>
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

      {/* Conversion Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1">
            {funnel.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1 flex-1">
                <div
                  className="flex-1 rounded-lg p-3 text-center"
                  style={{
                    backgroundColor: `hsl(var(--chart-${i + 1}) / ${0.15 + (1 - i * 0.15)})`,
                  }}
                >
                  <p className="text-lg font-bold">{step.value}</p>
                  <p className="text-[11px] text-muted-foreground">{step.label}</p>
                </div>
                {i < funnel.length - 1 && (
                  <span className="text-xs text-muted-foreground font-medium shrink-0 px-1">
                    {funnel[i + 1].pct}%→
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Channel Performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Channel Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Metric</TableHead>
                {channelPerf.map(c => (
                  <TableHead key={c.channel} className="text-xs">{c.channel}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-sm font-medium">Total Eligible</TableCell>
                {channelPerf.map(c => <TableCell key={c.channel} className="text-sm">{c.eligible}</TableCell>)}
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">Contacted</TableCell>
                {channelPerf.map(c => <TableCell key={c.channel} className="text-sm">{c.contacted}</TableCell>)}
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">Reply Rate</TableCell>
                {channelPerf.map(c => <TableCell key={c.channel} className="text-sm">{c.replyRate}%</TableCell>)}
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">Conversion Rate</TableCell>
                {channelPerf.map(c => <TableCell key={c.channel} className="text-sm">{c.conversionRate}%</TableCell>)}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Category Performance */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Category Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="contacted" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="converted" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Weekly Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily Activity (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" interval={4} />
              <YAxis className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="instagram" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="whatsapp" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="email" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
