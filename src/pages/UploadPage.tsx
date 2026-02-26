import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Upload, FileUp, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  CATEGORIES, CITIES, parseCSVContent, parseXLSXSheets, detectColumnTypes, cleanUsername, cleanPhone, cleanEmail,
  deriveFriendlyName, generateClaimLink, generateInstaMessage, generateWhatsAppMessage,
  generateEmailSubject, generateEmailBody, detectCategoryFromText,
  type ColumnType, type ParsedSheet,
} from "@/lib/vendor-utils";
import { determineSequenceType, getSequenceSteps } from "@/lib/sequence-utils";

interface UploadResult {
  total: number;
  duplicates: number;
  enriched: number;
  newAdded: number;
  noContact: number;
  enrichDetails: { phone: number; email: number; instagram: number };
  channelEligibility: { instagram: number; whatsapp: number; email: number };
  categoryCounts: Record<string, number>;
}

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([]);
  const [columnMappings, setColumnMappings] = useState<{ header: string; detected: ColumnType }[]>([]);
  const { toast } = useToast();

  const effectiveCity = city === "other" ? customCity : city;

  const isSingleColumn = useMemo(() => {
    return parsedRows.length > 0 && parsedRows[0].length === 1;
  }, [parsedRows]);

  const detectedSummary = useMemo(() => {
    if (parsedRows.length === 0) return null;
    if (isSingleColumn) return `${parsedRows.length} Instagram handles detected`;
    const mapped = columnMappings.filter(m => m.detected !== "ignore");
    const types = mapped.map(m => {
      switch (m.detected) {
        case "instagram": return "📸 Instagram";
        case "phone": return "📞 Phone";
        case "email": return "📧 Email";
        case "name": return "👤 Names";
        case "category": return "📁 Categories";
        case "city": return "🏙️ Cities";
        case "website": return "🌐 Website";
        default: return null;
      }
    }).filter(Boolean);
    const rowCount = parsedSheets.reduce((sum, s) => sum + s.dataRows.length, 0);
    return `${rowCount} rows with ${types.join(", ")}`;
  }, [parsedRows, parsedSheets, columnMappings, isSingleColumn]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
    );
    if (droppedFiles.length > 0) processFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  }, []);

  const processFiles = async (newFiles: File[]) => {
    setFiles(newFiles);
    setResult(null);
    
    const allSheets: ParsedSheet[] = [];
    const allRows: string[][] = [];

    for (const f of newFiles) {
      if (f.name.endsWith(".xlsx") || f.name.endsWith(".xls")) {
        const sheets = await parseXLSXSheets(f);
        allSheets.push(...sheets);
        allRows.push(...sheets.flatMap(s => s.dataRows));
      } else {
        const text = await f.text();
        const rows = parseCSVContent(text);
        if (rows.length === 0) continue;
        
        const firstRow = rows[0];
        const looksLikeHeader = firstRow.some(cell => /^[a-zA-Z_\s]+$/.test(cell) && !/[@.]/.test(cell) && cell.length > 2);
        const headers = looksLikeHeader ? firstRow : firstRow.map((_, i) => `Column ${i + 1}`);
        const dataRows = looksLikeHeader ? rows.slice(1) : rows;
        const columnMaps = detectColumnTypes(headers, dataRows);
        allSheets.push({ sheetName: f.name, headers, dataRows, columnMappings: columnMaps });
        allRows.push(...dataRows);
      }
    }

    setParsedSheets(allSheets);
    setParsedRows(allRows);
    if (allSheets.length > 0) {
      setColumnMappings(allSheets[0].columnMappings);
    }
  };

  const processRows = (
    dataRows: string[][],
    colMap: Record<string, number>,
    existingByUsername: Map<string, any>,
    existingByPhone: Map<string, any>,
    existingByEmail: Map<string, any>,
    seenUsernames: Set<string>,
    seenPhones: Set<string>,
    seenEmails: Set<string>,
    globalIndex: number,
    claimLinkBase?: string,
  ) => {
    let duplicates = 0, enrichedCount = 0, newAdded = 0, noContact = 0;
    const enrichDetails = { phone: 0, email: 0, instagram: 0 };
    const newVendors: any[] = [];
    const updateOps: { id: string; updates: Record<string, any> }[] = [];
    const categoryCounts: Record<string, number> = {};
    let instaEligible = 0, waEligible = 0, emailEligible = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const idx = globalIndex + i;
      const rawInsta = colMap.instagram !== undefined ? row[colMap.instagram] ?? "" : "";
      const rawPhone = colMap.phone !== undefined ? row[colMap.phone] ?? "" : "";
      const rawEmail = colMap.email !== undefined ? row[colMap.email] ?? "" : "";
      const rawName = colMap.name !== undefined ? row[colMap.name] ?? "" : "";
      const rawCat = colMap.category !== undefined ? row[colMap.category]?.toLowerCase().trim() ?? "" : "";
      const rawCity = colMap.city !== undefined ? row[colMap.city]?.trim() ?? "" : "";
      const rawWebsite = colMap.website !== undefined ? row[colMap.website]?.trim() ?? "" : "";

      const username = cleanUsername(rawInsta);
      const phone = cleanPhone(rawPhone);
      const email = cleanEmail(rawEmail);
      const businessName = rawName.trim() || null;

      if (!username && !phone && !email) { noContact++; continue; }

      // Deduplicate within the current batch
      if (username && seenUsernames.has(username)) { duplicates++; continue; }
      if (phone && seenPhones.has(phone)) { duplicates++; continue; }
      if (email && seenEmails.has(email)) { duplicates++; continue; }

      let vendorCategory = category === "auto" ? null : (category || null);
      if (!vendorCategory && rawCat) {
        const matched = CATEGORIES.find(c => c.key === rawCat || c.label.toLowerCase() === rawCat);
        if (matched) vendorCategory = matched.key;
      }
      if (!vendorCategory) {
        const textsToCheck = [businessName, username, email].filter(Boolean).join(" ");
        vendorCategory = detectCategoryFromText(textsToCheck) ?? "uncategorized";
      }

      let vendorCity = city === "auto" ? null : effectiveCity || null;
      if (!vendorCity && rawCity) vendorCity = rawCity;
      if (!vendorCity) vendorCity = "Bangalore";

      let matchedVendor = username ? existingByUsername.get(username) : undefined;
      if (!matchedVendor && phone) matchedVendor = existingByPhone.get(phone);
      if (!matchedVendor && email) matchedVendor = existingByEmail.get(email);

      if (matchedVendor) {
        const updates: Record<string, any> = {};
        if (!matchedVendor.phone && phone) { updates.phone = phone; updates.has_phone = true; enrichDetails.phone++; }
        if (!matchedVendor.email && email) { updates.email = email; updates.has_email = true; enrichDetails.email++; }
        if (!matchedVendor.username && username) { updates.username = username; updates.has_instagram = true; enrichDetails.instagram++; }
      if (!matchedVendor.full_name && businessName) updates.full_name = businessName;
      if (!matchedVendor.website && rawWebsite) updates.website = rawWebsite;

        if (Object.keys(updates).length > 0) {
          const fullName = updates.full_name || matchedVendor.full_name || "";
          const name = deriveFriendlyName(updates.username || matchedVendor.username, fullName, updates.email || matchedVendor.email);
          const effectivePhone = updates.phone || matchedVendor.phone;
          const effectiveEmail = updates.email || matchedVendor.email;
          if (updates.has_phone || !matchedVendor.claim_link || matchedVendor.claim_link.includes("/signup")) {
            updates.claim_link = generateClaimLink(fullName || name, effectivePhone, effectiveEmail, claimLinkBase);
          }
          const link = updates.claim_link || matchedVendor.claim_link;
          const cat = matchedVendor.category;
          const ct = matchedVendor.city;
          if (updates.has_phone && !matchedVendor.whatsapp_message) {
            updates.whatsapp_message = generateWhatsAppMessage(name, cat, ct, link, idx);
          }
          if (updates.has_email && !matchedVendor.email_body) {
            updates.email_subject = generateEmailSubject(name, cat, idx);
            updates.email_body = generateEmailBody(name, cat, ct, link);
          }
          if (updates.has_instagram && !matchedVendor.insta_message) {
            updates.insta_message = generateInstaMessage(name, cat, ct, link, idx);
            updates.profile_url = `https://www.instagram.com/${updates.username}/`;
          }
          updateOps.push({ id: matchedVendor.id, updates });
          enrichedCount++;
        } else {
          duplicates++;
        }
        continue;
      }

      // Track seen identifiers for within-batch dedup
      if (username) seenUsernames.add(username);
      if (phone) seenPhones.add(phone);
      if (email) seenEmails.add(email);

      const name = deriveFriendlyName(username, businessName, email);
      const claimLink = generateClaimLink(businessName || name, phone, email, claimLinkBase);
      const hasInsta = !!username;
      const hasPhone = !!phone;
      const hasEmail = !!email;

      const vendor: any = {
        username, phone, email,
        website: rawWebsite || null,
        full_name: businessName || name,
        category: vendorCategory,
        city: vendorCity,
        claim_link: claimLink,
        profile_url: username ? `https://www.instagram.com/${username}/` : "",
        has_instagram: hasInsta,
        has_phone: hasPhone,
        has_email: hasEmail,
        insta_status: "pending",
        whatsapp_status: "pending",
        email_status: "pending",
        overall_status: "pending",
        needs_review: false,
        status: "pending",
        message: "",
      };

      if (hasInsta) vendor.insta_message = generateInstaMessage(name, vendorCategory, vendorCity, claimLink, idx);
      if (hasPhone) vendor.whatsapp_message = generateWhatsAppMessage(name, vendorCategory, vendorCity, claimLink, idx);
      if (hasEmail) {
        vendor.email_subject = generateEmailSubject(name, vendorCategory, idx);
        vendor.email_body = generateEmailBody(name, vendorCategory, vendorCity, claimLink);
      }
      vendor.message = vendor.insta_message || vendor.whatsapp_message || "";

      if (hasInsta) instaEligible++;
      if (hasPhone) waEligible++;
      if (hasEmail) emailEligible++;
      categoryCounts[vendorCategory] = (categoryCounts[vendorCategory] || 0) + 1;

      newVendors.push(vendor);
      newAdded++;
    }

    return { duplicates, enrichedCount, newAdded, noContact, enrichDetails, newVendors, updateOps, categoryCounts, instaEligible, waEligible, emailEligible };
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setResult(null);

    try {
      const [{ data: existing }, { data: settingsRows }] = await Promise.all([
        supabase.from("vendors").select("*"),
        supabase.from("settings").select("*").eq("key", "claim_link_base"),
      ]);
      const claimLinkBase = settingsRows?.[0]?.value || undefined;

      const existingByUsername = new Map((existing ?? []).filter(v => v.username).map(v => [v.username!, v]));
      const existingByPhone = new Map((existing ?? []).filter(v => v.phone).map(v => [v.phone!, v]));
      const existingByEmail = new Map((existing ?? []).filter(v => v.email).map(v => [v.email!, v]));

      // Track seen identifiers across all sheets for dedup
      const seenUsernames = new Set(existingByUsername.keys());
      const seenPhones = new Set(existingByPhone.keys());
      const seenEmails = new Set(existingByEmail.keys());

      let totalDuplicates = 0, totalEnriched = 0, totalNewAdded = 0, totalRows = 0, totalNoContact = 0;
      const totalEnrichDetails = { phone: 0, email: 0, instagram: 0 };
      const allNewVendors: any[] = [];
      const allUpdateOps: { id: string; updates: Record<string, any> }[] = [];
      const totalCategoryCounts: Record<string, number> = {};
      let totalInsta = 0, totalWa = 0, totalEmail = 0;

      // Process all sheets (both xlsx and csv are now stored as sheets)
      let globalIndex = 0;
      for (const sheet of parsedSheets) {
        const colMap: Record<string, number> = {};
        sheet.columnMappings.forEach((m, i) => {
          if (m.detected !== "ignore" && !(m.detected in colMap)) colMap[m.detected] = i;
        });

        // Handle single-column case
        if (sheet.headers.length === 1 && Object.keys(colMap).length === 0) {
          colMap.instagram = 0;
        }

        const result = processRows(sheet.dataRows, colMap, existingByUsername, existingByPhone, existingByEmail, seenUsernames, seenPhones, seenEmails, globalIndex, claimLinkBase);
        totalDuplicates += result.duplicates;
        totalEnriched += result.enrichedCount;
        totalNewAdded += result.newAdded;
        totalNoContact += result.noContact;
        totalRows += sheet.dataRows.length;
        totalEnrichDetails.phone += result.enrichDetails.phone;
        totalEnrichDetails.email += result.enrichDetails.email;
        totalEnrichDetails.instagram += result.enrichDetails.instagram;
        allNewVendors.push(...result.newVendors);
        allUpdateOps.push(...result.updateOps);
        totalInsta += result.instaEligible;
        totalWa += result.waEligible;
        totalEmail += result.emailEligible;
        for (const [key, count] of Object.entries(result.categoryCounts)) {
          totalCategoryCounts[key] = (totalCategoryCounts[key] || 0) + count;
        }
        globalIndex += sheet.dataRows.length;
      }

      const uploadCategory = category === "auto" ? "mixed" : (category || "mixed");
      const uploadCity = city === "auto" ? "mixed" : (effectiveCity || "mixed");
      const { data: uploadRecord } = await supabase
        .from("uploads")
        .insert({
          filename: files.map(f => f.name).join(", "),
          category: uploadCategory,
          city: uploadCity,
          total_in_file: totalRows,
          duplicates: totalDuplicates,
          enriched: totalEnriched,
          new_added: totalNewAdded,
        })
        .select()
        .maybeSingle();

      for (const op of allUpdateOps) {
        await supabase.from("vendors").update(op.updates).eq("id", op.id);
      }

      let actualInserted = 0;
      if (allNewVendors.length > 0 && uploadRecord) {
        const withUploadId = allNewVendors.map(v => ({ ...v, upload_id: uploadRecord.id }));
        for (let i = 0; i < withUploadId.length; i += 500) {
          const batch = withUploadId.slice(i, i + 500);
          const { error } = await supabase.from("vendors").insert(batch);
          if (error) {
            for (const vendor of batch) {
              const { error: singleErr } = await supabase.from("vendors").insert(vendor);
              if (!singleErr) actualInserted++;
            }
          } else {
            actualInserted += batch.length;
          }
        }
        totalNewAdded = actualInserted;

        // Create sequences for newly inserted vendors
        if (actualInserted > 0 && uploadRecord) {
          const { data: newVendors } = await supabase.from("vendors").select("id, has_instagram, has_phone, has_email").eq("upload_id", uploadRecord.id);
          if (newVendors && newVendors.length > 0) {
            const sequences = newVendors.map(v => {
              const seqType = determineSequenceType(v.has_instagram, v.has_phone, v.has_email);
              return {
                vendor_id: v.id,
                sequence_type: seqType,
                steps: getSequenceSteps(seqType) as any,
                current_step: 0,
                is_active: true,
              };
            });
            // Insert in batches
            for (let i = 0; i < sequences.length; i += 500) {
              await supabase.from("vendor_sequences").insert(sequences.slice(i, i + 500) as any);
            }
          }
        }
      }

      setResult({
        total: totalRows,
        duplicates: totalDuplicates,
        enriched: totalEnriched,
        newAdded: totalNewAdded,
        noContact: totalNoContact,
        enrichDetails: totalEnrichDetails,
        channelEligibility: { instagram: totalInsta, whatsapp: totalWa, email: totalEmail },
        categoryCounts: totalCategoryCounts,
      });
      toast({ title: "Upload complete!", description: `${totalNewAdded} new, ${totalEnriched} enriched` });
    } catch (err) {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const resetUpload = () => {
    setFiles([]);
    setParsedRows([]);
    setParsedSheets([]);
    setColumnMappings([]);
    setResult(null);
    setCategory("");
    setCity("");
    setCustomCity("");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Vendors</h1>
        <p className="text-muted-foreground mt-1">Drop a CSV file — we'll handle the rest automatically</p>
      </div>

      {!result ? (
        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Drop zone */}
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 cursor-pointer transition-all ${
                dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input type="file" accept=".csv,.xlsx,.xls" multiple onChange={handleFileSelect} className="hidden" />
              {files.length > 0 ? (
                <>
                  <FileUp className="h-10 w-10 text-primary mb-3" />
                  <p className="font-semibold text-lg">{files.length === 1 ? files[0].name : `${files.length} files selected`}</p>
                  {detectedSummary && (
                    <p className="text-sm text-muted-foreground mt-1">{detectedSummary}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Click or drop to replace</p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-semibold">Drop your CSV or Excel files here</p>
                  <p className="text-sm text-muted-foreground mt-1">Multiple files supported — we auto-detect columns</p>
                </>
              )}
            </label>

            {/* Category & City - compact row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    {CATEGORIES.filter(c => c.key !== "uncategorized").map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">City</label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {city === "other" && (
                  <Input placeholder="Enter city name" value={customCity} onChange={(e) => setCustomCity(e.target.value)} className="mt-2" />
                )}
              </div>
            </div>

            <Button onClick={handleUpload} disabled={files.length === 0 || processing} className="w-full h-12 text-base">
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Upload & Process"
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Result card */
        <Card className="border-status-sent animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-status-sent">
              <CheckCircle2 className="h-5 w-5" />
              Upload Complete!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold">{result.newAdded}</p>
                <p className="text-xs text-muted-foreground">New Vendors</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold">{result.enriched}</p>
                <p className="text-xs text-muted-foreground">Enriched</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold">{result.duplicates}</p>
                <p className="text-xs text-muted-foreground">Duplicates Skipped</p>
              </div>
              {result.noContact > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-2xl font-bold">{result.noContact}</p>
                  <p className="text-xs text-muted-foreground">No Contact Info</p>
                </div>
              )}
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
            </div>

            {/* Channel eligibility */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">Channel Eligibility</p>
              <div className="flex flex-wrap gap-3 text-sm">
                {result.channelEligibility.instagram > 0 && (
                  <span className="flex items-center gap-1">📸 {result.channelEligibility.instagram}</span>
                )}
                {result.channelEligibility.whatsapp > 0 && (
                  <span className="flex items-center gap-1">💬 {result.channelEligibility.whatsapp}</span>
                )}
                {result.channelEligibility.email > 0 && (
                  <span className="flex items-center gap-1">📧 {result.channelEligibility.email}</span>
                )}
              </div>
            </div>

            {/* Enrichment details */}
            {result.enriched > 0 && (
              <div className="rounded-lg border p-3 space-y-1 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Enrichment Details</p>
                {result.enrichDetails.phone > 0 && <p>+{result.enrichDetails.phone} phone numbers added</p>}
                {result.enrichDetails.email > 0 && <p>+{result.enrichDetails.email} emails added</p>}
                {result.enrichDetails.instagram > 0 && <p>+{result.enrichDetails.instagram} Instagram handles added</p>}
              </div>
            )}

            {/* Categories */}
            {Object.keys(result.categoryCounts).length > 0 && (
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-sm font-medium">Categories</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.categoryCounts).map(([key, count]) => (
                    <span key={key} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                      {CATEGORIES.find(c => c.key === key)?.label ?? key}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={resetUpload} variant="outline" className="w-full">
              Upload Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
