import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// NEW Supabase
const NEW_URL = "https://dmpsgcfifnamuxcsdzzd.supabase.co";
const NEW_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcHNnY2ZpZm5hbXV4Y3NkenpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDA2NzEsImV4cCI6MjA4NzYxNjY3MX0.c7pfweJ4hYq1DenVSd0pvvpj51r1YL1ZzqgIO9fuvDs";

const supabase = createClient(NEW_URL, NEW_KEY);

async function importData() {
  const args = process.argv.slice(2);
  const filename = args[0] || "backup-2026-02-26.json";
  
  console.log(`Reading ${filename}...\n`);
  const data = JSON.parse(readFileSync(filename, "utf-8"));

  // Import order matters due to foreign keys
  const importOrder = [
    "uploads",
    "settings",
    "message_templates",
    "vendors",
    "outreach_log",
    "paused_sessions",
    "vendor_sequences"
  ];

  for (const table of importOrder) {
    const rows = data[table];
    if (!rows || rows.length === 0) {
      console.log(`${table}: skipping (no data)`);
      continue;
    }

    console.log(`Importing ${table} (${rows.length} rows)...`);
    
    const batchSize = 100;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from(table).insert(batch);
      
      if (error) {
        console.log(`  Batch error: ${error.message}`);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }
    
    console.log(`  Inserted: ${inserted}, Errors: ${errors}`);
  }

  console.log("\nImport complete!");
}

importData().catch(console.error);
