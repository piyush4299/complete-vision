import type { SequenceStep, SequenceType } from "./sequence-utils";
import { SEQUENCE_TIERS, determineSequenceType, SEQUENCE_LABELS } from "./sequence-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Channel = "instagram" | "whatsapp" | "email";

export interface DailyTask {
  vendorId: string;
  vendorName: string;
  category: string;
  city: string;
  channel: Channel;
  type: "initial" | "followup";
  priority: number;
  isOverdue: boolean;
  daysOverdue: number;
  identifier: string;
  sequenceLabel: string;
  stepNumber: number;
  totalSteps: number;
  availableChannels: Channel[];
}

export interface Session {
  id: string;
  label: string;
  description: string;
  channel: Channel | "mixed";
  sessionType: "overdue" | "followup" | "outreach";
  tasks: DailyTask[];
  estimatedMinutes: number;
  urgent: boolean;
}

export interface ChannelProgress {
  doneToday: number;
  target: number;
  safeLimit: number;
  remaining: number;
  weeklyDone: number;
  weeklyCap: number;
  pct: number;
  safe: boolean;
}

export interface PerformanceSnapshot {
  total: number;
  insta: number;
  wa: number;
  email: number;
  replies: number;
  signups: number;
}

export interface DailyPlan {
  sessions: Session[];
  plannedTasks: DailyTask[];
  progress: Record<Channel, ChannelProgress>;
  doneToday: { instagram: number; whatsapp: number; email: number; total: number; replies: number };
  yesterday: PerformanceSnapshot;
  thisWeek: PerformanceSnapshot;
  hotLeads: any[];
  timeRecommendation: { channel: Channel; label: string; reason: string };
  totalTasks: number;
  totalEstimatedMinutes: number;
  overallPct: number;
}

// ─── Safety Limits ───────────────────────────────────────────────────────────

type AccountAge = "new" | "warm" | "aged";

const SAFETY_LIMITS: Record<AccountAge, { daily: number; weekly: number; burst: number; pauseSec: number }> = {
  new:  { daily: 15, weekly: 70,  burst: 3, pauseSec: 300 },
  warm: { daily: 25, weekly: 140, burst: 5, pauseSec: 180 },
  aged: { daily: 40, weekly: 200, burst: 5, pauseSec: 120 },
};

function getInstaSafetyLimit(settings: Record<string, string>, userId?: string): { daily: number; weekly: number } {
  // Per-agent keys take priority over global defaults
  const ageKey = userId && settings[`${userId}:insta_account_age`]
    ? `${userId}:insta_account_age`
    : "insta_account_age";
  const blockKey = userId && settings[`${userId}:insta_last_action_block`]
    ? `${userId}:insta_last_action_block`
    : "insta_last_action_block";

  const age = (settings[ageKey] || "warm") as AccountAge;
  const base = SAFETY_LIMITS[age] || SAFETY_LIMITS.warm;

  const lastBlock = settings[blockKey];
  if (lastBlock) {
    const daysSinceBlock = Math.floor((Date.now() - new Date(lastBlock).getTime()) / 86400000);
    if (daysSinceBlock < 7) {
      return { daily: Math.floor(base.daily * 0.5), weekly: Math.floor(base.weekly * 0.5) };
    }
  }
  return { daily: base.daily, weekly: base.weekly };
}

// ─── Time helpers ────────────────────────────────────────────────────────────

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function isYesterday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.toDateString() === y.toDateString();
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return d >= monday && d <= now;
}

function getTimeRecommendation(): { channel: Channel; label: string; reason: string } {
  const h = new Date().getHours();
  if (h < 9)  return { channel: "email",     label: "Email",     reason: "Business inboxes are checked first thing in the morning" };
  if (h < 13) return { channel: "instagram",  label: "Instagram", reason: "Peak engagement window — vendors are browsing" };
  if (h < 15) return { channel: "email",      label: "Email",     reason: "Post-lunch email check window" };
  if (h < 18) return { channel: "whatsapp",   label: "WhatsApp",  reason: "Afternoon activity spike on WhatsApp" };
  if (h < 20) return { channel: "instagram",  label: "Instagram", reason: "Evening browsing peak" };
  return { channel: "email", label: "Review", reason: "Late — review data and plan for tomorrow" };
}

// ─── Priority Scoring ────────────────────────────────────────────────────────

const CATEGORY_CONVERSION_BONUS: Record<string, number> = {
  photographer: 15,
  mua: 12,
  decorator: 10,
  caterer: 8,
  venue: 6,
  dj: 5,
  uncategorized: 0,
};

function scorePriority(
  type: "initial" | "followup",
  isOverdue: boolean,
  daysOverdue: number,
  category: string,
  uploadedDaysAgo: number,
  hasAllChannels: boolean,
): number {
  let score = 0;

  if (isOverdue && type === "followup") score += 100 + Math.min(daysOverdue * 5, 50);
  else if (isOverdue && type === "initial") score += 90 + Math.min(daysOverdue * 5, 50);
  else if (type === "followup") score += 80;

  score += CATEGORY_CONVERSION_BONUS[category] || 0;

  if (uploadedDaysAgo <= 2) score += 30;
  else if (uploadedDaysAgo <= 7) score += 15;
  else if (uploadedDaysAgo <= 14) score += 5;

  if (hasAllChannels) score += 10;

  return score;
}

// ─── Vendor channel helpers ──────────────────────────────────────────────────

function vendorHasChannel(v: any, ch: string): boolean {
  if (ch === "instagram") return !!v.has_instagram;
  if (ch === "whatsapp") return !!v.has_phone;
  if (ch === "email") return !!v.has_email;
  return false;
}

function vendorChannelStatus(v: any, ch: string): string {
  if (ch === "instagram") return v.insta_status || "pending";
  if (ch === "whatsapp") return v.whatsapp_status || "pending";
  if (ch === "email") return v.email_status || "pending";
  return "pending";
}

function vendorContactedAt(v: any, ch: string): string | null {
  if (ch === "instagram") return v.insta_contacted_at;
  if (ch === "whatsapp") return v.whatsapp_contacted_at;
  if (ch === "email") return v.email_contacted_at;
  return null;
}

function getVendorChannels(v: any): Channel[] {
  const chs: Channel[] = [];
  if (v.has_instagram) chs.push("instagram");
  if (v.has_phone) chs.push("whatsapp");
  if (v.has_email) chs.push("email");
  return chs;
}

// ─── Core Engine ─────────────────────────────────────────────────────────────

const EXCLUDED_STATUSES = new Set(["interested", "not_interested", "declined", "converted", "maybe_later", "invalid"]);

export function buildDailyPlan(
  vendors: any[],
  sequences: any[],
  logs: any[],
  settings: Record<string, string>,
  userId?: string,
  totalAgents: number = 1,
  agentIndex: number = 0,
): DailyPlan {

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // ── Step 1: Count what's done today (filtered to current user if multi-user) ─

  const todayLogs = logs.filter(l => isToday(l.created_at));
  const mySentToday = todayLogs.filter(l =>
    (l.action === "sent" || l.action === "followed_up") &&
    (!userId || !l.user_id || l.user_id === userId)
  );

  // Vendors skipped today should not reappear in today's queue
  const skippedTodaySet = new Set<string>();
  for (const l of todayLogs) {
    if (l.action === "skipped") skippedTodaySet.add(`${l.vendor_id}:${l.channel}`);
  }

  const doneToday = {
    instagram: mySentToday.filter(l => l.channel === "instagram").length,
    whatsapp:  mySentToday.filter(l => l.channel === "whatsapp").length,
    email:     mySentToday.filter(l => l.channel === "email").length,
    total: 0,
    replies: vendors.filter(v => v.responded_at && isToday(v.responded_at)).length,
  };
  doneToday.total = doneToday.instagram + doneToday.whatsapp + doneToday.email;

  // ── Step 2: Calculate safe limits per channel ────────────────────────────

  const instaSafety = getInstaSafetyLimit(settings, userId);
  const instaTarget = Math.min(
    parseInt(settings.instagram_daily_target || "30"),
    instaSafety.daily
  );

  const weekLogs = logs.filter(l => isThisWeek(l.created_at) && (l.action === "sent" || l.action === "followed_up"));
  const weeklyInsta = weekLogs.filter(l => l.channel === "instagram").length;
  const weeklyWa    = weekLogs.filter(l => l.channel === "whatsapp").length;
  const weeklyEmail = weekLogs.filter(l => l.channel === "email").length;

  const effectiveInstaDaily = Math.min(instaTarget, Math.max(0, instaSafety.weekly - weeklyInsta));

  const waTarget    = parseInt(settings.whatsapp_daily_target || "20");
  const emailTarget = parseInt(settings.email_daily_target || "15");

  const agentCount = Math.max(1, totalAgents);
  const myInstaTarget = Math.ceil(effectiveInstaDaily / agentCount);
  const myWaTarget    = Math.ceil(waTarget / agentCount);
  const myEmailTarget = Math.ceil(emailTarget / agentCount);

  const remaining: Record<Channel, number> = {
    instagram: Math.max(0, myInstaTarget - doneToday.instagram),
    whatsapp:  Math.max(0, myWaTarget - doneToday.whatsapp),
    email:     Math.max(0, myEmailTarget - doneToday.email),
  };

  const progress: Record<Channel, ChannelProgress> = {
    instagram: {
      doneToday: doneToday.instagram,
      target: myInstaTarget,
      safeLimit: instaSafety.daily,
      remaining: remaining.instagram,
      weeklyDone: weeklyInsta,
      weeklyCap: instaSafety.weekly,
      pct: myInstaTarget > 0 ? Math.round((doneToday.instagram / myInstaTarget) * 100) : 0,
      safe: doneToday.instagram < instaSafety.daily,
    },
    whatsapp: {
      doneToday: doneToday.whatsapp,
      target: myWaTarget,
      safeLimit: 50,
      remaining: remaining.whatsapp,
      weeklyDone: weeklyWa,
      weeklyCap: 300,
      pct: myWaTarget > 0 ? Math.round((doneToday.whatsapp / myWaTarget) * 100) : 0,
      safe: true,
    },
    email: {
      doneToday: doneToday.email,
      target: myEmailTarget,
      safeLimit: 50,
      remaining: remaining.email,
      weeklyDone: weeklyEmail,
      weeklyCap: 500,
      pct: myEmailTarget > 0 ? Math.round((doneToday.email / myEmailTarget) * 100) : 0,
      safe: true,
    },
  };

  // ── Step 3: Build task list ──────────────────────────────────────────────

  const fuDays: Record<Channel, number> = {
    instagram: parseInt(settings.days_insta_followup || "5"),
    whatsapp:  parseInt(settings.days_wa_followup || "3"),
    email:     parseInt(settings.days_email_followup || "4"),
  };

  const seqByVendor = new Map<string, any>();
  for (const seq of sequences) {
    if (seq.is_active) seqByVendor.set(seq.vendor_id, seq);
  }

  const allTasks: DailyTask[] = [];

  for (const v of vendors) {
    if (EXCLUDED_STATUSES.has(v.overall_status)) continue;

    const uploadedDaysAgo = Math.floor((now - new Date(v.created_at).getTime()) / 86400000);
    const hasAll = v.has_instagram && v.has_phone && v.has_email;
    const availableChannels = getVendorChannels(v);

    const seq = seqByVendor.get(v.id);

    if (seq) {
      // ── Path A: Vendor has a DB sequence ──────────────────────────────
      const steps: SequenceStep[] = (typeof seq.steps === "string" ? JSON.parse(seq.steps) : seq.steps) as SequenceStep[];
      const currentStep = steps[seq.current_step];
      if (!currentStep || currentStep.channel === "exhausted") continue;

      // Skip if this vendor+channel was skipped today
      if (skippedTodaySet.has(`${v.id}:${currentStep.channel}`)) continue;

      // If sequence was advanced to a followup step but the initial was
      // never actually sent (status is "skipped"/"pending"), don't create
      // a followup — can't follow up on an unsent message.
      const chStatus = vendorChannelStatus(v, currentStep.channel);
      if (currentStep.type === "followup" && chStatus !== "sent") continue;

      const activeSteps = steps.filter(s => s.channel !== "exhausted");
      const startDate = new Date(seq.started_at);
      const dueDate = new Date(startDate.getTime() + currentStep.day * 86400000);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate <= todayStart || dueDate.toDateString() === new Date().toDateString()) {
        const ch = currentStep.channel as Channel;
        const isOverdue = dueDate < todayStart;
        const daysOverdue = isOverdue ? Math.floor((todayStart.getTime() - dueDate.getTime()) / 86400000) : 0;

        if (remaining[ch] > 0) {
          allTasks.push({
            vendorId: v.id,
            vendorName: v.full_name || "Unknown",
            category: v.category,
            city: v.city,
            channel: ch,
            type: currentStep.type as "initial" | "followup",
            priority: scorePriority(currentStep.type as any, isOverdue, daysOverdue, v.category, uploadedDaysAgo, hasAll),
            isOverdue,
            daysOverdue,
            identifier: getIdentifier(v, ch),
            sequenceLabel: SEQUENCE_LABELS[seq.sequence_type as SequenceType] || "Custom",
            stepNumber: seq.current_step + 1,
            totalSteps: activeSteps.length,
            availableChannels,
          });
        } else {
          // Current step channel is budget-exhausted; look for an alternative
          // initial step on a channel that still has budget.
          for (let s = seq.current_step + 1; s < steps.length; s++) {
            const alt = steps[s];
            if (alt.channel === "exhausted") break;
            if (alt.type !== "initial") continue;
            const altCh = alt.channel as Channel;
            if (remaining[altCh] > 0 && vendorHasChannel(v, altCh) && vendorChannelStatus(v, altCh) === "pending") {
              allTasks.push({
                vendorId: v.id,
                vendorName: v.full_name || "Unknown",
                category: v.category,
                city: v.city,
                channel: altCh,
                type: "initial",
                priority: scorePriority("initial", isOverdue, daysOverdue, v.category, uploadedDaysAgo, hasAll) - 5,
                isOverdue,
                daysOverdue,
                identifier: getIdentifier(v, altCh),
                sequenceLabel: SEQUENCE_LABELS[seq.sequence_type as SequenceType] || "Custom",
                stepNumber: s + 1,
                totalSteps: activeSteps.length,
                availableChannels,
              });
              break;
            }
          }
        }
      }
    } else {
      // ── Path B: No sequence — simulate one from channel statuses ──────
      const seqType = determineSequenceType(!!v.has_instagram, !!v.has_phone, !!v.has_email);
      const steps = SEQUENCE_TIERS[seqType];
      const activeSteps = steps.filter(s => s.channel !== "exhausted" && vendorHasChannel(v, s.channel));

      let taskAdded = false;

      for (let i = 0; i < steps.length; i++) {
        if (taskAdded) break;
        const step = steps[i];
        if (step.channel === "exhausted") break;
        if (!vendorHasChannel(v, step.channel)) continue;
        if (skippedTodaySet.has(`${v.id}:${step.channel}`)) continue;

        const status = vendorChannelStatus(v, step.channel);
        const contactedAt = vendorContactedAt(v, step.channel);
        const stepIdx = activeSteps.findIndex(s => s === step);

        if (step.type === "initial") {
          const needsInitial = status === "pending" || status === "skipped";
          if (needsInitial) {
            // Check if all previous initial steps are done OR their channel
            // budget is exhausted for today (so we can skip ahead).
            const prevInitials = steps
              .slice(0, i)
              .filter(s => s.type === "initial" && s.channel !== "exhausted" && vendorHasChannel(v, s.channel));

            const allPrevHandled = prevInitials.every(s => {
              const prevStatus = vendorChannelStatus(v, s.channel);
              if (prevStatus !== "pending" && prevStatus !== "skipped") return true;
              return remaining[s.channel as Channel] <= 0;
            });

            if (!allPrevHandled) continue;

            // Skip channels whose budget is already exhausted for today
            if (remaining[step.channel as Channel] <= 0) continue;

            // Check timing gap: wait N days after the last actually-completed step
            let readyToSend = true;
            const completedPrev = prevInitials.filter(s => {
              const ps = vendorChannelStatus(v, s.channel);
              return ps !== "pending" && ps !== "skipped";
            });
            if (completedPrev.length > 0) {
              const lastPrev = completedPrev[completedPrev.length - 1];
              const lastContactedAt = vendorContactedAt(v, lastPrev.channel);
              if (lastContactedAt) {
                const dayGap = step.day - lastPrev.day;
                const earliest = new Date(lastContactedAt).getTime() + dayGap * 86400000;
                if (earliest > now) readyToSend = false;
              }
            }

            if (readyToSend) {
              allTasks.push({
                vendorId: v.id,
                vendorName: v.full_name || "Unknown",
                category: v.category,
                city: v.city,
                channel: step.channel as Channel,
                type: "initial",
                priority: scorePriority("initial", false, 0, v.category, uploadedDaysAgo, hasAll),
                isOverdue: false,
                daysOverdue: 0,
                identifier: getIdentifier(v, step.channel as Channel),
                sequenceLabel: SEQUENCE_LABELS[seqType],
                stepNumber: stepIdx + 1,
                totalSteps: activeSteps.length,
                availableChannels,
              });
              taskAdded = true;
            }
          }
        } else if (step.type === "followup") {
          if (status === "sent" && contactedAt) {
            const contactDate = new Date(contactedAt);
            const dueDate = new Date(contactDate.getTime() + fuDays[step.channel as Channel] * 86400000);
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate <= todayStart || dueDate.toDateString() === new Date().toDateString()) {
              const isOverdue = dueDate < todayStart;
              const daysOverdue = isOverdue ? Math.floor((todayStart.getTime() - dueDate.getTime()) / 86400000) : 0;

              allTasks.push({
                vendorId: v.id,
                vendorName: v.full_name || "Unknown",
                category: v.category,
                city: v.city,
                channel: step.channel as Channel,
                type: "followup",
                priority: scorePriority("followup", isOverdue, daysOverdue, v.category, uploadedDaysAgo, hasAll),
                isOverdue,
                daysOverdue,
                identifier: getIdentifier(v, step.channel as Channel),
                sequenceLabel: SEQUENCE_LABELS[seqType],
                stepNumber: stepIdx + 1,
                totalSteps: activeSteps.length,
                availableChannels,
              });
              taskAdded = true;
            }
          }
        }
      }
    }
  }

  // ── Step 4: Sort by priority, split across agents, cap by budget ─────────

  allTasks.sort((a, b) => b.priority - a.priority);

  // Stable assignment: hash vendor ID to decide which agent owns each task.
  // This ensures the same vendor always goes to the same agent even when
  // other vendors are added/removed from the list.
  const myTasks = agentCount > 1
    ? allTasks.filter(task => {
        let h = 0;
        for (let i = 0; i < task.vendorId.length; i++) {
          h = ((h << 5) - h) + task.vendorId.charCodeAt(i);
          h |= 0;
        }
        return Math.abs(h) % agentCount === agentIndex;
      })
    : allTasks;

  const budgetRemaining = { ...remaining };
  const plannedTasks: DailyTask[] = [];

  for (const task of myTasks) {
    if (budgetRemaining[task.channel] > 0) {
      plannedTasks.push(task);
      budgetRemaining[task.channel]--;
    }
  }

  // Cap targets to what's actually achievable (don't show 0/8 when only 1 vendor exists)
  for (const ch of ["instagram", "whatsapp", "email"] as Channel[]) {
    const inQueue = plannedTasks.filter(t => t.channel === ch).length;
    const achievable = progress[ch].doneToday + inQueue;
    if (achievable < progress[ch].target) {
      progress[ch].target = achievable;
      progress[ch].remaining = inQueue;
      progress[ch].pct = achievable > 0
        ? Math.round((progress[ch].doneToday / achievable) * 100)
        : 100;
    }
  }

  // ── Step 5: Group into sessions ──────────────────────────────────────────

  const sessions: Session[] = [];

  const overdues = plannedTasks.filter(t => t.isOverdue && t.type === "followup");
  if (overdues.length > 0) {
    sessions.push({
      id: "overdue",
      label: "Overdue Follow-ups",
      description: `${overdues.length} follow-up${overdues.length > 1 ? "s" : ""} past due — handle first`,
      channel: "mixed",
      sessionType: "overdue",
      tasks: overdues,
      estimatedMinutes: Math.ceil(overdues.length * 0.5),
      urgent: true,
    });
  }

  for (const ch of ["instagram", "whatsapp", "email"] as Channel[]) {
    const fuTasks = plannedTasks.filter(t => !t.isOverdue && t.type === "followup" && t.channel === ch);
    if (fuTasks.length > 0) {
      const label = ch === "instagram" ? "Instagram" : ch === "whatsapp" ? "WhatsApp" : "Email";
      sessions.push({
        id: `followup-${ch}`,
        label: `${label} Follow-ups`,
        description: `${fuTasks.length} follow-up${fuTasks.length > 1 ? "s" : ""} due today`,
        channel: ch,
        sessionType: "followup",
        tasks: fuTasks,
        estimatedMinutes: Math.ceil(fuTasks.length * 0.5),
        urgent: false,
      });
    }
  }

  for (const ch of ["instagram", "whatsapp", "email"] as Channel[]) {
    const newTasks = plannedTasks.filter(t => t.type === "initial" && t.channel === ch);
    if (newTasks.length > 0) {
      const label = ch === "instagram" ? "Instagram" : ch === "whatsapp" ? "WhatsApp" : "Email";
      sessions.push({
        id: `outreach-${ch}`,
        label: `${label} Outreach`,
        description: `${newTasks.length} new vendor${newTasks.length > 1 ? "s" : ""} to reach`,
        channel: ch,
        sessionType: "outreach",
        tasks: newTasks,
        estimatedMinutes: Math.ceil(newTasks.length * (ch === "instagram" ? 0.5 : 0.4)),
        urgent: false,
      });
    }
  }

  // ── Step 6: Performance snapshots ────────────────────────────────────────

  const sentLogsYesterday = logs.filter(l => (l.action === "sent" || l.action === "followed_up") && isYesterday(l.created_at));
  const yesterday: PerformanceSnapshot = {
    total: sentLogsYesterday.length,
    insta: sentLogsYesterday.filter(l => l.channel === "instagram").length,
    wa: sentLogsYesterday.filter(l => l.channel === "whatsapp").length,
    email: sentLogsYesterday.filter(l => l.channel === "email").length,
    replies: vendors.filter(v => v.responded_at && isYesterday(v.responded_at)).length,
    signups: vendors.filter(v => v.overall_status === "converted" && v.updated_at && isYesterday(v.updated_at)).length,
  };

  const sentLogsWeek = logs.filter(l => (l.action === "sent" || l.action === "followed_up") && isThisWeek(l.created_at));
  const thisWeek: PerformanceSnapshot = {
    total: sentLogsWeek.length,
    insta: sentLogsWeek.filter(l => l.channel === "instagram").length,
    wa: sentLogsWeek.filter(l => l.channel === "whatsapp").length,
    email: sentLogsWeek.filter(l => l.channel === "email").length,
    replies: vendors.filter(v => v.responded_at && isThisWeek(v.responded_at)).length,
    signups: vendors.filter(v => v.overall_status === "converted" && v.updated_at && isThisWeek(v.updated_at)).length,
  };

  const hotLeads = vendors
    .filter(v => v.overall_status === "interested")
    .sort((a, b) => new Date(b.responded_at || 0).getTime() - new Date(a.responded_at || 0).getTime())
    .slice(0, 5);

  const totalTasks = plannedTasks.length;
  const totalEstimatedMinutes = sessions.reduce((s, sess) => s + sess.estimatedMinutes, 0);
  const totalTarget = progress.instagram.target + progress.whatsapp.target + progress.email.target;
  const overallPct = totalTarget > 0 ? Math.round((doneToday.total / totalTarget) * 100) : 0;

  return {
    sessions,
    plannedTasks,
    progress,
    doneToday,
    yesterday,
    thisWeek,
    hotLeads,
    timeRecommendation: getTimeRecommendation(),
    totalTasks,
    totalEstimatedMinutes,
    overallPct,
  };
}

function getIdentifier(v: any, ch: Channel): string {
  if (ch === "instagram") return v.username ? `@${v.username}` : "";
  if (ch === "whatsapp") return v.phone || "";
  return v.email || "";
}
