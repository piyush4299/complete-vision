import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

// OLD Supabase (Lovable's project)
const OLD_URL = "https://jefrdgpleyzbzehaxaob.supabase.co";
const OLD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZnJkZ3BsZXl6YnplaGF4YW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTQxMDksImV4cCI6MjA4NzMzMDEwOX0.47aFyqaNRdCUS23KpPDSYxmmi62aQknWpZxEGjCTEFM";

const supabase = createClient(OLD_URL, OLD_KEY);

async function exportData() {
  console.log("Exporting data from old Supabase...\n");

  const tables = [
    "uploads",
    "vendors", 
    "outreach_log",
    "paused_sessions",
    "vendor_sequences",
    "settings",
    "message_templates"
  ];

  const exportData = {};

  for (const table of tables) {
    console.log(`Fetching ${table}...`);
    const { data, error } = await supabase.from(table).select("*");
    
    if (error) {
      console.log(`  Warning: ${error.message}`);
      exportData[table] = [];
    } else {
      exportData[table] = data || [];
      console.log(`  Found ${data?.length || 0} rows`);
    }
  }

  const filename = `backup-${new Date().toISOString().split("T")[0]}.json`;
  writeFileSync(filename, JSON.stringify(exportData, null, 2));
  console.log(`\nExported to ${filename}`);
  
  // Summary
  console.log("\n--- Summary ---");
  for (const [table, rows] of Object.entries(exportData)) {
    console.log(`${table}: ${rows.length} rows`);
  }
}

exportData().catch(console.error);
