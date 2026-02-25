import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Save, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CATEGORIES, CITIES, detectCategoryFromText } from "@/lib/vendor-utils";

export default function ReviewPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [edits, setEdits] = useState<Record<string, { category?: string; city?: string }>>({});
  const { toast } = useToast();

  const fetchData = async () => {
    const [{ data: flagged }, { data: uncategorized }, { data: unknownCity }] = await Promise.all([
      supabase.from("vendors").select("*").eq("needs_review", true),
      supabase.from("vendors").select("*").eq("category", "uncategorized"),
      supabase.from("vendors").select("*").eq("city", "Unknown"),
    ]);
    const merged = new Map<string, any>();
    for (const v of [...(flagged ?? []), ...(uncategorized ?? []), ...(unknownCity ?? [])]) {
      if (v.overall_status !== "invalid") merged.set(v.id, v);
    }
    setVendors([...merged.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  useEffect(() => { fetchData(); }, []);

  const updateEdit = (id: string, field: "category" | "city", value: string) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const save = async (v: any) => {
    const edit = edits[v.id];
    if (!edit) return;
    const updates: Record<string, any> = {};
    if (edit.category) updates.category = edit.category;
    if (edit.city) updates.city = edit.city;
    
    const newCat = edit.category || v.category;
    const newCity = edit.city || v.city;
    if (newCat !== "uncategorized" && newCity !== "Unknown") {
      updates.needs_review = false;
    }

    await supabase.from("vendors").update(updates).eq("id", v.id);
    toast({ title: "Saved!", duration: 1500 });
    setEdits(prev => { const n = { ...prev }; delete n[v.id]; return n; });
    fetchData();
    window.dispatchEvent(new Event("vendors-updated"));
  };

  const remove = async (id: string) => {
    await supabase.from("vendors").update({ overall_status: "invalid" }).eq("id", id);
    toast({ title: "Vendor removed", duration: 1500 });
    fetchData();
    window.dispatchEvent(new Event("vendors-updated"));
  };

  const [autoCategorizing, setAutoCategorizing] = useState(false);

  const autoCategorize = async () => {
    setAutoCategorizing(true);
    const uncategorized = vendors.filter(v => v.category === "uncategorized");

    const byCat = new Map<string, string[]>();
    let matchCount = 0;

    for (const v of uncategorized) {
      const text = [v.full_name, v.username, v.email].filter(Boolean).join(" ");
      const detected = detectCategoryFromText(text);
      if (detected && detected !== "uncategorized") {
        const ids = byCat.get(detected) || [];
        ids.push(v.id);
        byCat.set(detected, ids);
        matchCount++;
      }
    }

    if (matchCount === 0) {
      toast({ title: "No matches found", description: "Remaining vendors need manual categorization", duration: 2000 });
      setAutoCategorizing(false);
      return;
    }

    await Promise.all(
      [...byCat.entries()].map(([cat, ids]) =>
        supabase.from("vendors")
          .update({ category: cat, needs_review: false })
          .in("id", ids)
      )
    );

    toast({ title: `Auto-categorized ${matchCount} vendors`, duration: 2000 });
    setAutoCategorizing(false);
    await fetchData();
    window.dispatchEvent(new Event("vendors-updated"));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Queue</h1>
          <p className="text-muted-foreground mt-1">Vendors needing manual category or city assignment ({vendors.length})</p>
        </div>
        {vendors.some(v => v.category === "uncategorized") && (
          <Button onClick={autoCategorize} disabled={autoCategorizing} size="sm" variant="outline">
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            {autoCategorizing ? "Detecting..." : "Auto-Categorize"}
          </Button>
        )}
      </div>

      {vendors.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">🎉 All vendors have been reviewed!</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Instagram</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="text-sm font-medium">{v.full_name}</TableCell>
                    <TableCell className="text-xs font-mono">{v.username ? `@${v.username}` : "—"}</TableCell>
                    <TableCell className="text-xs">{v.phone || "—"}</TableCell>
                    <TableCell className="text-xs">{v.email || "—"}</TableCell>
                    <TableCell>
                      <Select value={edits[v.id]?.category || v.category} onValueChange={val => updateEdit(v.id, "category", val)}>
                        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={edits[v.id]?.city || v.city} onValueChange={val => updateEdit(v.id, "city", val)}>
                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-status-sent" onClick={() => save(v)} disabled={!edits[v.id]} title="Save"><Save className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(v.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
