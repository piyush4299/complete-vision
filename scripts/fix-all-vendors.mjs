import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jefrdgpleyzbzehaxaob.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZnJkZ3BsZXl6YnplaGF4YW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTQxMDksImV4cCI6MjA4NzMzMDEwOX0.47aFyqaNRdCUS23KpPDSYxmmi62aQknWpZxEGjCTEFM";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CLAIM_BASE = "https://www.cartevent.com/claim/";
const SIGNUP_FALLBACK = "https://www.cartevent.com/signup";

const GENERIC_WORDS = new Set(["the", "a", "an", "and", "of", "in", "at", "by", "for", "with", "on", "to", "is", "it", "my", "we", "us", "our", "hi", "hey", "hello", "dear", "mr", "mrs", "ms"]);

function deriveFriendlyName(username, fullName, email) {
  if (fullName && fullName.trim()) {
    const first = fullName.trim().split(/\s+/)[0];
    if (!GENERIC_WORDS.has(first.toLowerCase()) && first.length > 1) return first;
    const words = fullName.trim().split(/\s+/);
    for (const w of words) {
      if (!GENERIC_WORDS.has(w.toLowerCase()) && w.length > 1) return w;
    }
    return first;
  }
  if (username) {
    const prefix = username.replace(/^@/, "").split(/[0-9]+$/)[0];
    const withSpaces = prefix.replace(/[_.]/g, " ");
    const words = withSpaces.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const firstWord = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      if (!GENERIC_WORDS.has(words[0].toLowerCase())) return firstWord;
    }
  }
  return "there";
}

function generateClaimLink(name, phone, email) {
  if (!phone) return SIGNUP_FALLBACK;
  const json = JSON.stringify({ b: name, m: phone, e: email || "" });
  const b64 = Buffer.from(json).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return CLAIM_BASE + b64;
}

const INSTA_TEMPLATES = [
  (n,c,ct,l) => `Hi ${n}! Your ${c} work is stunning. We're building CartEvent — a free platform where event vendors in ${ct} get leads & direct bookings. No upfront cost, just 5% on successful bookings. Join 500+ vendors — takes 30 seconds: ${l}`,
  (n,c,ct,l) => `Hey ${n}! Love your ${c} portfolio. CartEvent is a new platform helping ${ct} event vendors get more bookings — completely free to join. You only pay when you earn. Claim your profile here: ${l}`,
  (n,c,ct,l) => `Hi ${n}! We came across your amazing ${c} work in ${ct}. We'd love to feature you on CartEvent — it's a free vendor marketplace where customers find and book event pros directly. Set up your profile in 30 sec: ${l}`,
  (n,c,ct,l) => `Hey ${n}! Your work caught our eye. CartEvent helps ${c}s in ${ct} get discovered by thousands of customers looking for event services. Free to list, no commitments. Check it out: ${l}`,
];

const WA_TEMPLATES = [
  (n,c,ct,l) => `Hi ${n}! 👋 We found your ${c} business in ${ct} and we're impressed. CartEvent is a free platform where vendors like you get direct bookings from customers. No listing fee — you only pay 5% when you earn. Takes 30 sec to join: ${l}`,
  (n,c,ct,l) => `Hey ${n}! CartEvent is helping ${c}s in ${ct} get more event bookings. Free to join, thousands of customers searching every month. Claim your profile: ${l}`,
  (n,c,ct,l) => `Hi ${n}! Quick question — are you open to getting more ${c} bookings in ${ct}? CartEvent is a free vendor marketplace. 500+ vendors already on board. Check it out: ${l}`,
  (n,c,ct,l) => `Hey ${n}! We're reaching out to top ${c}s in ${ct}. CartEvent is a free platform where customers find and book event vendors directly. Would love to have you: ${l}`,
];

const EMAIL_SUBJECTS = [
  (n,c) => `Free listing for your ${c} business on CartEvent`,
  (n,c) => `${n}, get more bookings through CartEvent (free)`,
  (n,c) => `Invitation: Join 500+ event vendors on CartEvent`,
  (n,c) => `Your ${c} business deserves more visibility, ${n}`,
];

function generateEmailBody(n,c,ct,l) {
  return `Hi ${n},\n\nI came across your ${c} business in ${ct} and wanted to reach out.\n\nWe're building CartEvent (cartevent.com) — a platform where customers search and book event vendors directly. Think of it as a marketplace specifically for the events industry.\n\nHere's what makes it worth checking out:\n• Free to list — no subscription, no upfront cost\n• You only pay 5% on successful bookings\n• 500+ vendors already on board, with customers searching daily\n\nSetting up your profile takes 30 seconds:\n${l}\n\nHappy to answer any questions!\n\nBest,\nAnkit Kumar\nCartEvent\ncartevent.com`;
}

const CATEGORIES = {
  photographer: "photographer", mua: "makeup artist", decorator: "decorator",
  caterer: "caterer", venue: "venue", dj: "DJ", planner: "event planner",
  mehndi: "mehndi artist", anchor: "anchor", choreographer: "choreographer",
  invitation: "invitation designer", entertainment: "entertainment",
  uncategorized: "vendor",
};

async function main() {
  console.log("Fetching all vendors...");
  const { data: vendors, error } = await supabase.from("vendors").select("*");
  if (error) { console.error("Error:", error); return; }
  console.log(`Found ${vendors.length} vendors`);
  console.log(`  With phone: ${vendors.filter(v => v.phone).length}`);
  console.log(`  Without phone: ${vendors.filter(v => !v.phone).length}`);
  console.log();

  let updated = 0, errors = 0;

  for (const v of vendors) {
    const name = deriveFriendlyName(v.username, v.full_name, v.email);
    const fullName = v.full_name || name;
    const claimLink = generateClaimLink(fullName, v.phone, v.email);
    const cat = CATEGORIES[v.category] || v.category || "vendor";
    const city = v.city || "Bangalore";
    const idx = updated % 4;

    const updates = { claim_link: claimLink };

    if (v.has_instagram) {
      updates.insta_message = INSTA_TEMPLATES[idx](name, cat, city, claimLink);
    }
    if (v.has_phone) {
      updates.whatsapp_message = WA_TEMPLATES[idx](name, cat, city, claimLink);
    }
    if (v.has_email) {
      updates.email_subject = EMAIL_SUBJECTS[idx](name, cat);
      updates.email_body = generateEmailBody(name, cat, city, claimLink);
    }

    const { error: updateError } = await supabase
      .from("vendors")
      .update(updates)
      .eq("id", v.id);

    if (updateError) {
      console.error(`  Error updating ${v.full_name}:`, updateError.message);
      errors++;
    } else {
      updated++;
    }
  }

  console.log(`\nUpdated ${updated} vendors (${errors} errors)`);

  // Update settings
  console.log("\nUpdating settings...");
  const settingsToUpsert = [
    { key: "claim_link_base", value: "https://www.cartevent.com/claim/" },
  ];
  for (const s of settingsToUpsert) {
    const { error } = await supabase
      .from("settings")
      .upsert({ ...s, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) console.error(`  Error setting ${s.key}:`, error.message);
    else console.log(`  ${s.key} = ${s.value}`);
  }

  // Verify a few
  console.log("\nVerification — first 5 vendors with phone:");
  const { data: sample } = await supabase
    .from("vendors")
    .select("full_name,phone,claim_link")
    .not("phone", "is", null)
    .neq("phone", "")
    .limit(5);
  for (const v of sample || []) {
    console.log(`  ${v.full_name}: ${v.claim_link.substring(0, 70)}...`);
  }

  console.log("\nVerification — first 3 vendors without phone:");
  const { data: sample2 } = await supabase
    .from("vendors")
    .select("full_name,claim_link")
    .or("phone.is.null,phone.eq.")
    .limit(3);
  for (const v of sample2 || []) {
    console.log(`  ${v.full_name}: ${v.claim_link}`);
  }

  console.log("\nDone!");
}

main().catch(console.error);
