import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Copy, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CATEGORIES } from "@/lib/vendor-utils";

const PAGE_SIZE = 50;

export default function HotLeadsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await supabase.from("vendors").select("*").eq("overall_status", "interested").order("responded_at", { ascending: false });
    setVendors(data ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", duration: 1500 });
  };

  const markConverted = async (id: string) => {
    await supabase.from("vendors").update({ overall_status: "converted" }).eq("id", id);
    toast({ title: "Marked as converted! 🎉", duration: 2000 });
    fetchData();
  };

  const getRespondedChannel = (v: any) => {
    if (v.responded_channel === "instagram") return "📸 Instagram";
    if (v.responded_channel === "whatsapp") return "💬 WhatsApp";
    if (v.responded_channel === "email") return "📧 Email";
    return "—";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">🔥 Hot Leads</h1>
        <p className="text-muted-foreground mt-1">{vendors.length} interested vendors ready to convert</p>
      </div>

      <Card>
        <CardContent className="overflow-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Response Date</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium text-sm">{v.full_name}</TableCell>
                  <TableCell className="text-xs">{CATEGORIES.find(c => c.key === v.category)?.label ?? v.category}</TableCell>
                  <TableCell className="text-xs">{v.city}</TableCell>
                  <TableCell className="text-xs">{getRespondedChannel(v)}</TableCell>
                  <TableCell className="text-xs">{v.responded_at ? new Date(v.responded_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{v.notes || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(v.claim_link)} title="Copy Claim Link">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => markConverted(v.id)}>
                        <Trophy className="h-3 w-3 mr-1" /> Converted
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {vendors.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hot leads yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {vendors.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 px-2">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, vendors.length)} of {vendors.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(vendors.length / PAGE_SIZE)}</span>
                <Button variant="outline" size="sm" disabled={page >= Math.ceil(vendors.length / PAGE_SIZE)} onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
