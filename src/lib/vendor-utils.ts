// Generic words — if first word matches, use "there"
const GENERIC_WORDS = new Set([
  "the", "a", "an", "bangalore", "mumbai", "delhi", "hyderabad", "chennai",
  "pune", "kolkata", "jaipur", "india", "indian", "wedding", "weddings",
  "photography", "photographer", "photos", "photo", "makeup", "makeover",
  "decor", "decoration", "decorations", "catering", "caterer", "event",
  "events", "official", "studio", "studios", "team", "group", "best",
  "top", "premium", "royal", "golden", "creative", "digital", "shree", "sri", "shri", "new",
]);

export const CATEGORIES = [
  { key: "photographer", label: "Photographer" },
  { key: "mua", label: "Makeup Artist" },
  { key: "decorator", label: "Decorator" },
  { key: "caterer", label: "Caterer" },
  { key: "venue", label: "Venue" },
  { key: "dj", label: "DJ / Entertainment" },
  { key: "uncategorized", label: "Uncategorized" },
] as const;

export const CITIES = [
  "Bangalore", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Jaipur",
];

// --- Column type detection ---

export type ColumnType = "instagram" | "phone" | "email" | "name" | "category" | "city" | "website" | "ignore";

const CATEGORY_RULES: { pattern: RegExp; category: string }[] = [
  // Photographer / Videographer — substring matches for compound usernames
  { pattern: /photo/i, category: "photographer" },
  { pattern: /foto/i, category: "photographer" },
  { pattern: /shoot/i, category: "photographer" },
  { pattern: /clicks/i, category: "photographer" },
  { pattern: /capture/i, category: "photographer" },
  { pattern: /camera/i, category: "photographer" },
  { pattern: /frame/i, category: "photographer" },
  { pattern: /pixel/i, category: "photographer" },
  { pattern: /pixl/i, category: "photographer" },
  { pattern: /snap/i, category: "photographer" },
  { pattern: /portrait/i, category: "photographer" },
  { pattern: /candid/i, category: "photographer" },
  { pattern: /cinematograph/i, category: "photographer" },
  { pattern: /videograph/i, category: "photographer" },
  { pattern: /studio/i, category: "photographer" },
  { pattern: /moment/i, category: "photographer" },
  { pattern: /\bfilm/i, category: "photographer" },
  { pattern: /visual/i, category: "photographer" },
  { pattern: /\blens/i, category: "photographer" },

  // Makeup Artist / Beauty — substring matches for compound usernames
  { pattern: /make\s*up/i, category: "mua" },
  { pattern: /\bmua\b/i, category: "mua" },
  { pattern: /\bbeauty\b/i, category: "mua" },
  { pattern: /bridal\s*look/i, category: "mua" },
  { pattern: /makeover/i, category: "mua" },
  { pattern: /cosmetic/i, category: "mua" },
  { pattern: /\bglam/i, category: "mua" },
  { pattern: /salon/i, category: "mua" },
  { pattern: /\bhair\b/i, category: "mua" },
  { pattern: /henna/i, category: "mua" },
  { pattern: /mehn?di/i, category: "mua" },

  // Decorator / Event Planner
  { pattern: /decor/i, category: "decorator" },
  { pattern: /floral/i, category: "decorator" },
  { pattern: /mandap/i, category: "decorator" },
  { pattern: /\bstage\b/i, category: "decorator" },
  { pattern: /flower/i, category: "decorator" },
  { pattern: /event\s*design/i, category: "decorator" },
  { pattern: /backdrop/i, category: "decorator" },
  { pattern: /planner/i, category: "decorator" },
  { pattern: /event\s*manage/i, category: "decorator" },
  { pattern: /wedding\s*plan/i, category: "decorator" },
  { pattern: /\bevents?\b/i, category: "decorator" },

  // Caterer
  { pattern: /cater/i, category: "caterer" },
  { pattern: /\bfood\b/i, category: "caterer" },
  { pattern: /cuisine/i, category: "caterer" },
  { pattern: /biryani/i, category: "caterer" },
  { pattern: /kitchen/i, category: "caterer" },
  { pattern: /\bchef\b/i, category: "caterer" },
  { pattern: /\bcook/i, category: "caterer" },
  { pattern: /\bmenu\b/i, category: "caterer" },
  { pattern: /tiffin/i, category: "caterer" },
  { pattern: /recipe/i, category: "caterer" },
  { pattern: /bake/i, category: "caterer" },
  { pattern: /\bsweet/i, category: "caterer" },
  { pattern: /\bcake/i, category: "caterer" },

  // Venue
  { pattern: /\bvenue\b/i, category: "venue" },
  { pattern: /banquet/i, category: "venue" },
  { pattern: /\bhall\b/i, category: "venue" },
  { pattern: /\bfarm\b/i, category: "venue" },
  { pattern: /resort/i, category: "venue" },
  { pattern: /palace/i, category: "venue" },
  { pattern: /\bgarden\b/i, category: "venue" },
  { pattern: /\blawn\b/i, category: "venue" },
  { pattern: /convention/i, category: "venue" },
  { pattern: /kalyana\s*mantapa/i, category: "venue" },

  // DJ / Entertainment — \bdj catches djrahul, djpinto etc. at word boundaries
  { pattern: /\bdj/i, category: "dj" },
  { pattern: /\bd\s+j\b/i, category: "dj" },
  { pattern: /deejay/i, category: "dj" },
  { pattern: /disc\s*jockey/i, category: "dj" },
  { pattern: /\bdhol\b/i, category: "dj" },
  { pattern: /\bsangeet\b/i, category: "dj" },
  { pattern: /entertainment/i, category: "dj" },
  { pattern: /\bband\b/i, category: "dj" },
  { pattern: /music/i, category: "dj" },
  { pattern: /sound/i, category: "dj" },
  { pattern: /tattoo/i, category: "dj" },
  { pattern: /\banchor\b/i, category: "dj" },
  { pattern: /\bemcee\b/i, category: "dj" },
  { pattern: /\bmc\b/i, category: "dj" },
];

export function detectCategoryFromText(text: string): string | null {
  const lower = text.toLowerCase().replace(/[_.-]/g, " ");
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(lower)) return rule.category;
  }
  return null;
}

export function isPhoneNumber(val: string): boolean {
  const cleaned = val.replace(/[\s\-\(\)\+]/g, "");
  // Indian mobile: optionally starts with 91 or 0, then 10 digits starting with 6-9
  if (/^(91)?[6-9]\d{9}$/.test(cleaned)) return true;
  if (/^0[6-9]\d{9}$/.test(cleaned)) return true;
  return false;
}

export function isInstagramHandle(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed || trimmed.length < 2) return false;
  // Reject any URL that isn't Instagram
  if (/^https?:\/\//i.test(trimmed) && !trimmed.includes("instagram.com/")) return false;
  if (trimmed.includes("instagram.com/")) return true;
  // Reject known non-handle patterns
  if (/^[\d.]+$/.test(trimmed)) return false; // ratings like "4.6"
  if (/^n\/a$/i.test(trimmed)) return false;
  if (/\s/.test(trimmed)) return false; // handles never have spaces
  // Reject if looks like an email
  if (trimmed.includes("@") && trimmed.includes(".") && !trimmed.startsWith("@")) return false;
  // @ prefixed handle
  if (trimmed.startsWith("@")) {
    const handle = trimmed.slice(1);
    if (/^https?:\/\//i.test(handle)) return false;
    if (handle.length < 2 || handle.length > 30) return false;
    return /^[a-zA-Z0-9_.]+$/.test(handle);
  }
  // Bare handle: must have underscore or dot (to distinguish from regular words/names)
  // OR be very short. Plain words like "Fotovibez" should NOT match.
  if (/^[a-zA-Z0-9_.]{2,30}$/.test(trimmed) && (trimmed.includes("_") || trimmed.includes("."))) return true;
  return false;
}

export function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

export function isNameLike(val: string): boolean {
  if (!val || val.length < 2) return false;
  if (isPhoneNumber(val) || isEmail(val) || isInstagramHandle(val)) return false;
  // Contains space and has title-case-ish words
  return /\s/.test(val) && /^[a-zA-Z\s'.]+$/.test(val);
}

export function isWebsite(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  // Must look like a URL or domain
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed) && !trimmed.includes("@")) return true;
  return false;
}

export function detectColumnType(values: string[]): ColumnType {
  const sample = values.filter(Boolean).slice(0, 20);
  if (sample.length === 0) return "ignore";
  
  let phoneCount = 0, instaCount = 0, emailCount = 0, nameCount = 0, websiteCount = 0;
  const citySet = new Set(CITIES.map(c => c.toLowerCase()));
  let cityCount = 0;
  let catCount = 0;

  for (const v of sample) {
    if (isPhoneNumber(v)) phoneCount++;
    if (isEmail(v)) emailCount++;
    if (isWebsite(v)) websiteCount++;
    if (isInstagramHandle(v)) instaCount++;
    if (isNameLike(v)) nameCount++;
    if (citySet.has(v.toLowerCase().trim())) cityCount++;
    if (detectCategoryFromText(v)) catCount++;
  }

  const threshold = sample.length * 0.4;
  // Order matters: more specific types first
  if (emailCount >= threshold) return "email";
  if (phoneCount >= threshold) return "phone";
  if (cityCount >= threshold) return "city";
  if (catCount >= threshold) return "category";
  if (websiteCount >= threshold) return "website";
  // Instagram needs higher confidence since bare words can false-positive
  if (instaCount >= sample.length * 0.6) return "instagram";
  if (nameCount >= threshold) return "name";
  
  return "ignore";
}

export function detectColumnTypes(headers: string[], rows: string[][]): { header: string; detected: ColumnType }[] {
  return headers.map((header, colIdx) => {
    const headerLower = header.toLowerCase();
    // Check header names first
    if (["username", "handle", "instagram", "insta", "ig"].some(p => headerLower.includes(p))) {
      return { header, detected: "instagram" };
    }
    if (["phone", "mobile", "contact", "whatsapp", "wa"].some(p => headerLower.includes(p))) {
      return { header, detected: "phone" as ColumnType };
    }
    if (["email", "mail"].some(p => headerLower.includes(p))) {
      return { header, detected: "email" as ColumnType };
    }
    if (["name", "business", "vendor"].some(p => headerLower.includes(p))) {
      return { header, detected: "name" as ColumnType };
    }
    if (["city", "location", "place"].some(p => headerLower.includes(p))) {
      return { header, detected: "city" as ColumnType };
    }
    if (["category", "type", "service"].some(p => headerLower.includes(p))) {
      return { header, detected: "category" as ColumnType };
    }
    if (["website", "web", "site", "url", "link", "webpage"].some(p => headerLower.includes(p))) {
      return { header, detected: "website" as ColumnType };
    }
    // Fall back to content detection
    const values = rows.map(r => r[colIdx] ?? "");
    return { header, detected: detectColumnType(values) };
  });
}

// --- Cleaning functions ---

export function cleanUsername(raw: string): string | null {
  let u = raw.trim();
  // Reject non-Instagram URLs (facebook, websites, etc.)
  if (/^https?:\/\//i.test(u) && !u.toLowerCase().includes("instagram.com/")) return null;
  // Reject ratings like "4.6", "4.3"
  if (/^[\d.]+$/.test(u)) return null;
  // Reject n/a
  if (/^n\/a$/i.test(u)) return null;
  u = u.replace(/https?:\/\/(www\.)?instagram\.com\//i, "");
  u = u.replace(/^@/, "");
  u = u.replace(/\/+$/, "");
  u = u.replace(/\?.*$/, ""); // strip query params
  u = u.toLowerCase().trim();
  if (u.length < 2 || /\s/.test(u)) return null;
  // Must start with a letter or digit and only contain valid IG chars
  if (!/^[a-zA-Z0-9_.]+$/.test(u)) return null;
  return u;
}

export function cleanPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-\(\)\+]/g, "");
  let digits = cleaned;
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (/^[6-9]\d{9}$/.test(digits)) return digits;
  return null;
}

export function cleanEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed;
  return null;
}

export function deriveFriendlyName(username?: string | null, businessName?: string | null, email?: string | null): string {
  // Try business name first
  if (businessName) {
    const words = businessName.trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const first = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
      if (!GENERIC_WORDS.has(words[0].toLowerCase())) return first;
    }
  }
  // Try Instagram handle
  if (username) {
    const withSpaces = username.replace(/[_.]/g, " ");
    const words = withSpaces.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const firstWord = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      if (!GENERIC_WORDS.has(words[0].toLowerCase())) return firstWord;
    }
  }
  // Try email prefix
  if (email) {
    const prefix = email.split("@")[0];
    const withSpaces = prefix.replace(/[_.]/g, " ");
    const words = withSpaces.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const firstWord = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      if (!GENERIC_WORDS.has(words[0].toLowerCase())) return firstWord;
    }
  }
  return "there";
}

const DEFAULT_CLAIM_BASE = "https://www.cartevent.com/claim/";
const SIGNUP_FALLBACK = "https://www.cartevent.com/signup";

export function generateClaimLink(
  friendlyName: string,
  phone?: string | null,
  email?: string | null,
  baseUrl?: string,
): string {
  if (!phone) return SIGNUP_FALLBACK;

  const base = (baseUrl || DEFAULT_CLAIM_BASE).replace(/\/+$/, "") + "/";
  const json = JSON.stringify({ b: friendlyName, m: phone, e: email || "" });
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const b64 = btoa(binary);
  const urlSafe = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${base}${urlSafe}`;
}

export function regenerateVendorMessages(
  vendor: any,
  claimLink: string,
  idx: number = 0,
): { insta_message?: string; whatsapp_message?: string; email_subject?: string; email_body?: string } {
  const name = deriveFriendlyName(vendor.username, vendor.full_name, vendor.email);
  const cat = vendor.category;
  const city = vendor.city;
  const result: any = {};
  if (vendor.has_instagram) result.insta_message = generateInstaMessage(name, cat, city, claimLink, idx);
  if (vendor.has_phone) result.whatsapp_message = generateWhatsAppMessage(name, cat, city, claimLink, idx);
  if (vendor.has_email) {
    result.email_subject = generateEmailSubject(name, cat, city, idx);
    result.email_body = generateEmailBody(name, cat, city, claimLink, idx);
  }
  return result;
}

export function applyTemplatePlaceholders(body: string, vendor: any): string {
  const name = vendor.full_name || deriveFriendlyName(vendor.username, vendor.full_name, vendor.email);
  const catLabel = CATEGORIES.find(c => c.key === vendor.category)?.label.toLowerCase() ?? vendor.category;
  return body
    .replace(/\{name\}/g, name)
    .replace(/\{category\}/g, catLabel)
    .replace(/\{city\}/g, vendor.city || "")
    .replace(/\{claim_link\}/g, vendor.claim_link || "");
}

export function stableVendorHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h) + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// --- Multi-channel message templates ---

const INSTA_TEMPLATES = [
  (n: string, cat: string, city: string, link: string) =>
    `${n}, quick one —\n\nWe're inviting select ${cat}s in ${city} to join a fast-growing event booking platform.\n\n75+ vendors joined in Bangalore within 15 days.\n\nYou've been selected.\n\nActivate here (unique link):\n${link}\n\nPlatform:\ncartevent.com\n\nStart receiving leads + bookings.`,
  (n: string, cat: string, city: string, link: string) =>
    `Hi ${n},\n\nYou're among the select ${cat}s in ${city} we're inviting right now.\n\n75+ vendors already onboard in 15 days.\n\nYour activation link:\n${link}\n\nWebsite:\ncartevent.com`,
];

const WA_TEMPLATES = [
  (n: string, cat: string, city: string, link: string) =>
    `Hi ${n},\n\nWe're inviting select ${cat}s in ${city} to join a fast-growing event platform.\n\n75+ vendors already onboard in Bangalore within 15 days.\n\nYou've been selected.\n\nActivate your unique profile here:\n${link}\n\nWebsite:\ncartevent.com\n\nSign up and start receiving leads and bookings.`,
  (n: string, cat: string, city: string, link: string) =>
    `Hi ${n},\n\nYou've been selected for onboarding as a ${cat} in ${city}.\n\n75+ vendors joined within 15 days of launch in Bangalore.\n\nActivate here:\n${link}\n\nPlatform:\ncartevent.com\n\nCompletely free right now.`,
];

const EMAIL_SUBJECTS = [
  (n: string, cat: string, city: string) => `You're among the top ${cat}s in ${city}`,
  (n: string, cat: string, city: string) => `${n}, quick update about your ${cat} profile`,
  (n: string, cat: string, city: string) => `Finalizing top ${cat}s in ${city}`,
];

const EMAIL_BODY_TEMPLATES = [
  (n: string, cat: string, city: string, link: string) =>
    `Hi ${n},\n\nWe're inviting select ${cat}s in ${city} to join a fast-growing event booking platform.\n\nIn just 15 days, 75+ vendors have already joined in Bangalore.\n\nBased on your profile, you've been selected for onboarding.\n\nActivate your unique profile here:\n${link}\n\nExplore the platform:\ncartevent.com\n\nSign up and start receiving leads and bookings.\n\n– Animesh\nCartEvent`,
  (n: string, cat: string, city: string, link: string) =>
    `Hi ${n},\n\nWe're currently curating select ${cat}s in ${city}.\n\n75+ vendors onboarded in Bangalore within 15 days of launch.\n\nYou've been selected to join.\n\nActivate here (unique link):\n${link}\n\nWebsite:\ncartevent.com\n\nEarly vendors get priority visibility.\n\n– Animesh`,
  (n: string, cat: string, city: string, link: string) =>
    `Hi ${n},\n\nWe're finalizing this batch of select ${cat}s in ${city}.\n\n75+ vendors already live in Bangalore.\n\nIf you'd like to be included:\n\nYour activation link:\n${link}\n\nPlatform:\ncartevent.com\n\nStart getting leads and bookings.\n\n– Animesh`,
];

export function generateInstaMessage(name: string, categoryKey: string, city: string, claimLink: string, index: number): string {
  const catLabel = CATEGORIES.find((c) => c.key === categoryKey)?.label.toLowerCase() ?? categoryKey;
  return INSTA_TEMPLATES[index % INSTA_TEMPLATES.length](name, catLabel, city, claimLink);
}

export function generateWhatsAppMessage(name: string, categoryKey: string, city: string, claimLink: string, index: number): string {
  const catLabel = CATEGORIES.find((c) => c.key === categoryKey)?.label.toLowerCase() ?? categoryKey;
  return WA_TEMPLATES[index % WA_TEMPLATES.length](name, catLabel, city, claimLink);
}

export function generateEmailSubject(name: string, categoryKey: string, city: string, index: number): string {
  const catLabel = CATEGORIES.find((c) => c.key === categoryKey)?.label.toLowerCase() ?? categoryKey;
  return EMAIL_SUBJECTS[index % EMAIL_SUBJECTS.length](name, catLabel, city);
}

export function generateEmailBody(name: string, categoryKey: string, city: string, claimLink: string, index: number = 0): string {
  const catLabel = CATEGORIES.find((c) => c.key === categoryKey)?.label.toLowerCase() ?? categoryKey;
  return EMAIL_BODY_TEMPLATES[index % EMAIL_BODY_TEMPLATES.length](name, catLabel, city, claimLink);
}

// Keep backward compat
export function generateMessage(name: string, categoryKey: string, city: string, claimLink: string, index: number): string {
  return generateInstaMessage(name, categoryKey, city, claimLink, index);
}

// --- Follow-up templates ---

export const FOLLOWUP_INSTA = (n: string, cat: string, link: string) =>
  `Quick check —\n\nShould we keep your onboarding invite active?\n\n${link}\n\ncartevent.com`;

export const FOLLOWUP_WA = (n: string, cat: string, link: string) =>
  `Just checking —\n\nShould we keep your onboarding invite active?\n\n${link}\n\ncartevent.com`;

export const FOLLOWUP_EMAIL_SUBJECT = (n: string) =>
  `Should we keep your spot active?`;

export const FOLLOWUP_EMAIL_BODY = (n: string, cat: string, city: string, link: string) =>
  `Hi ${n},\n\nJust checking — should we keep your onboarding invite active?\n\nYour unique link:\n${link}\n\nPlatform:\ncartevent.com\n\n– Animesh`;

export const FINAL_FOLLOWUP_INSTA = (n: string, cat: string, city: string, link: string) =>
  `We're finalizing this batch of ${cat}s in ${city}.\n\nConfirm your inclusion here:\n${link}\n\ncartevent.com`;

export const FINAL_FOLLOWUP_WA = (n: string, cat: string, city: string, link: string) =>
  `We're closing this onboarding round in ${city}.\n\nConfirm here if you'd like to be included:\n\n${link}\n\ncartevent.com`;

export const FINAL_FOLLOWUP_EMAIL_SUBJECT = (n: string, cat: string, city: string) =>
  `Confirming your inclusion`;

export const FINAL_FOLLOWUP_EMAIL_BODY = (n: string, cat: string, city: string, link: string) =>
  `Hi ${n},\n\nWe're closing this round of ${cat} onboarding in ${city}.\n\nIf you'd like to secure your profile:\n\n${link}\n\nWebsite:\ncartevent.com\n\n– Animesh`;

// Keep backward compat
export const FOLLOWUP_TEMPLATE = FOLLOWUP_INSTA;

// --- CSV parsing ---

export function parseCSVContent(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

// --- XLSX parsing (multi-sheet, per-sheet column detection) ---

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  dataRows: string[][];
  columnMappings: { header: string; detected: ColumnType }[];
}

export async function parseXLSXFile(file: File): Promise<string[][]> {
  // Simple fallback for backward compat — returns merged rows
  const sheets = await parseXLSXSheets(file);
  const allRows: string[][] = [];
  for (const sheet of sheets) {
    // Prepend headers for first sheet only
    if (allRows.length === 0 && sheet.headers.length > 0) {
      allRows.push(sheet.headers);
    }
    allRows.push(...sheet.dataRows);
  }
  return allRows;
}

export async function parseXLSXSheets(file: File): Promise<ParsedSheet[]> {
  const { read, utils } = await import("xlsx");
  const data = await file.arrayBuffer();
  const workbook = read(data);
  const sheets: ParsedSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = (utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][])
      .map(r => r.map(c => String(c ?? "").trim()))
      .filter(row => row.some(cell => cell !== ""));
    
    if (rows.length === 0) continue;

    const firstRow = rows[0];
    const looksLikeHeader = firstRow.some(cell =>
      /^[a-zA-Z_\s]+$/.test(cell) && !/[@.]/.test(cell) && cell.length > 2
    );

    const headers = looksLikeHeader ? firstRow : firstRow.map((_, i) => `Column ${i + 1}`);
    const dataRows = looksLikeHeader ? rows.slice(1) : rows;
    
    if (dataRows.length === 0) continue;

    const columnMappings = detectColumnTypes(headers, dataRows);
    sheets.push({ sheetName, headers, dataRows, columnMappings });
  }

  return sheets;
}

export function detectUsernameColumn(headers: string[]): number {
  const patterns = ["username", "handle", "user", "instagram", "profile", "account"];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (patterns.some((p) => h.includes(p))) return i;
  }
  return 0;
}

export function extractUsernames(rows: string[][]): string[] {
  if (rows.length === 0) return [];
  const firstRow = rows[0];
  const looksLikeHeader = firstRow.some((cell) => /^[a-zA-Z_\s]+$/.test(cell) && !/[@.]/.test(cell) && cell.length > 2);
  let colIndex = 0;
  let dataRows = rows;
  if (looksLikeHeader && rows.length > 1) {
    colIndex = detectUsernameColumn(firstRow);
    dataRows = rows.slice(1);
  }
  return dataRows
    .map((row) => row[colIndex] ?? "")
    .map(cleanUsername)
    .filter((u): u is string => u !== null);
}
