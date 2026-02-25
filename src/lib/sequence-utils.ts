import { Json } from "@/integrations/supabase/types";

export type SequenceStep = {
  day: number;
  channel: "instagram" | "whatsapp" | "email" | "exhausted";
  type: "initial" | "followup" | "end";
};

export type SequenceType = "tier_a" | "tier_b" | "tier_c" | "tier_d" | "tier_e";

const TIER_A: SequenceStep[] = [
  { day: 0, channel: "instagram", type: "initial" },
  { day: 3, channel: "whatsapp", type: "initial" },
  { day: 5, channel: "email", type: "initial" },
  { day: 8, channel: "instagram", type: "followup" },
  { day: 11, channel: "whatsapp", type: "followup" },
  { day: 14, channel: "email", type: "followup" },
  { day: 17, channel: "exhausted", type: "end" },
];

const TIER_B: SequenceStep[] = [
  { day: 0, channel: "whatsapp", type: "initial" },
  { day: 3, channel: "email", type: "initial" },
  { day: 7, channel: "whatsapp", type: "followup" },
  { day: 11, channel: "email", type: "followup" },
  { day: 14, channel: "exhausted", type: "end" },
];

const TIER_C: SequenceStep[] = [
  { day: 0, channel: "instagram", type: "initial" },
  { day: 5, channel: "instagram", type: "followup" },
  { day: 12, channel: "exhausted", type: "end" },
];

const TIER_D: SequenceStep[] = [
  { day: 0, channel: "whatsapp", type: "initial" },
  { day: 4, channel: "whatsapp", type: "followup" },
  { day: 10, channel: "exhausted", type: "end" },
];

const TIER_E: SequenceStep[] = [
  { day: 0, channel: "email", type: "initial" },
  { day: 5, channel: "email", type: "followup" },
  { day: 12, channel: "exhausted", type: "end" },
];

export const SEQUENCE_TIERS: Record<SequenceType, SequenceStep[]> = {
  tier_a: TIER_A,
  tier_b: TIER_B,
  tier_c: TIER_C,
  tier_d: TIER_D,
  tier_e: TIER_E,
};

export const SEQUENCE_LABELS: Record<SequenceType, string> = {
  tier_a: "Tier A (IG+WA+Email)",
  tier_b: "Tier B (WA+Email)",
  tier_c: "Tier C (IG only)",
  tier_d: "Tier D (WA only)",
  tier_e: "Tier E (Email only)",
};

export function determineSequenceType(hasInstagram: boolean, hasPhone: boolean, hasEmail: boolean): SequenceType {
  if (hasInstagram && hasPhone && hasEmail) return "tier_a";
  if (!hasInstagram && hasPhone && hasEmail) return "tier_b";
  if (hasInstagram && !hasPhone && !hasEmail) return "tier_c";
  if (!hasInstagram && hasPhone && !hasEmail) return "tier_d";
  if (!hasInstagram && !hasPhone && hasEmail) return "tier_e";
  // Fallback for partial combos
  if (hasInstagram && hasPhone) return "tier_a";
  if (hasInstagram && hasEmail) return "tier_a";
  return "tier_c";
}

export function getSequenceSteps(type: SequenceType): SequenceStep[] {
  return SEQUENCE_TIERS[type];
}

export const REENGAGEMENT_MESSAGE = (name: string, cat: string, link: string) =>
  `Hi ${name}! We reached out a while back about listing your ${cat} business on CartEvent. Since then, we've grown to 500+ vendors with customers actively booking. Would love to have you on board — it's still completely free: ${link}`;
