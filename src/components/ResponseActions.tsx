import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, ThumbsDown, MessageCircle, Undo2, Trash2 } from "lucide-react";

interface ResponseActionsProps {
  vendorId: string;
  currentStatus: string;
  computedStatus?: string;
  channel?: string;
  onUpdate: () => void;
  compact?: boolean;
}

export function ResponseActions({ vendorId, currentStatus, computedStatus, channel, onUpdate, compact = false }: ResponseActionsProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const { toast } = useToast();

  const setStatus = async (status: string) => {
    const update: Record<string, any> = {
      overall_status: status,
      responded_at: new Date().toISOString(),
    };
    if (channel) update.responded_channel = channel;
    await supabase.from("vendors").update(update).eq("id", vendorId);
    const labels: Record<string, string> = { interested: "Interested", not_interested: "Not Interested", converted: "Converted" };
    toast({ title: `Marked as ${labels[status] || status}`, duration: 1500 });
    onUpdate();
    window.dispatchEvent(new Event("vendors-updated"));
  };

  const revertStatus = async () => {
    await supabase.from("vendors").update({
      overall_status: "in_progress",
      responded_at: null,
      responded_channel: null,
    }).eq("id", vendorId);
    toast({ title: "Reverted to Contacted", duration: 1500 });
    onUpdate();
    window.dispatchEvent(new Event("vendors-updated"));
  };

  const revertToPending = async () => {
    await supabase.from("vendors").update({
      overall_status: "pending",
      insta_status: "pending",
      whatsapp_status: "pending",
      email_status: "pending",
      insta_contacted_at: null,
      whatsapp_contacted_at: null,
      email_contacted_at: null,
      responded_at: null,
      responded_channel: null,
    }).eq("id", vendorId);
    await supabase.from("outreach_log").delete().eq("vendor_id", vendorId);
    toast({ title: "Reverted to Pending", duration: 1500 });
    onUpdate();
    window.dispatchEvent(new Event("vendors-updated"));
  };

  const saveNote = async () => {
    const { data } = await supabase.from("vendors").select("notes").eq("id", vendorId).single();
    const existing = data?.notes || "";
    const timestamp = new Date().toLocaleDateString();
    const source = channel ? ` [${channel}]` : "";
    const updated = existing
      ? `${existing}\n[${timestamp}${source}] ${note}`
      : `[${timestamp}${source}] ${note}`;
    await supabase.from("vendors").update({ notes: updated }).eq("id", vendorId);
    toast({ title: "Note saved", duration: 1500 });
    setNoteOpen(false);
    setNote("");
    onUpdate();
  };

  const isTerminal = currentStatus === "interested" || currentStatus === "converted" || currentStatus === "not_interested" || currentStatus === "declined" || currentStatus === "maybe_later";
  const isInvalid = currentStatus === "invalid";
  const isContacted = computedStatus === "contacted";

  const markInvalid = async () => {
    await supabase.from("vendors").update({ overall_status: "invalid" }).eq("id", vendorId);
    toast({ title: "Vendor removed", duration: 1500 });
    onUpdate();
    window.dispatchEvent(new Event("vendors-updated"));
  };

  const size = compact ? "icon" : "sm";
  const cls = compact ? "h-7 w-7" : "h-8";

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {isInvalid ? (
          <Button variant="ghost" size={size} className={`${cls} text-orange-500 hover:text-orange-600 hover:bg-orange-50`} onClick={revertStatus} title="Restore Vendor">
            {compact ? <Undo2 className="h-3.5 w-3.5" /> : <><Undo2 className="h-3.5 w-3.5 mr-1" /> Restore</>}
          </Button>
        ) : isTerminal ? (
          <Button variant="ghost" size={size} className={`${cls} text-orange-500 hover:text-orange-600 hover:bg-orange-50`} onClick={revertStatus} title="Revert to Contacted">
            {compact ? <Undo2 className="h-3.5 w-3.5" /> : <><Undo2 className="h-3.5 w-3.5 mr-1" /> Revert</>}
          </Button>
        ) : (
          <>
            {isContacted && (
              <Button variant="ghost" size={size} className={`${cls} text-orange-500 hover:text-orange-600 hover:bg-orange-50`} onClick={revertToPending} title="Revert to Pending — undo all sent messages">
                {compact ? <Undo2 className="h-3.5 w-3.5" /> : <><Undo2 className="h-3.5 w-3.5 mr-1" /> Revert</>}
              </Button>
            )}
            <Button variant="ghost" size={size} className={cls} onClick={() => setStatus("interested")} title="Interested">
              {compact ? <ThumbsUp className="h-3.5 w-3.5 text-purple-600" /> : <><ThumbsUp className="h-3.5 w-3.5 mr-1 text-purple-600" /> Interested</>}
            </Button>
            <Button variant="ghost" size={size} className={cls} onClick={() => setStatus("not_interested")} title="Not Interested">
              {compact ? <ThumbsDown className="h-3.5 w-3.5 text-red-500" /> : <><ThumbsDown className="h-3.5 w-3.5 mr-1 text-red-500" /> Not Interested</>}
            </Button>
          </>
        )}
        {!isInvalid && (
          <Button variant="ghost" size={size} className={`${cls} text-gray-400 hover:text-red-500 hover:bg-red-50`} onClick={markInvalid} title="Remove — not a valid vendor">
            {compact ? <Trash2 className="h-3.5 w-3.5" /> : <><Trash2 className="h-3.5 w-3.5 mr-1" /> Remove</>}
          </Button>
        )}
        <Button variant="ghost" size={size} className={cls} onClick={() => setNoteOpen(true)} title="Add Note">
          {compact ? <MessageCircle className="h-3.5 w-3.5 text-blue-500" /> : <><MessageCircle className="h-3.5 w-3.5 mr-1 text-blue-500" /> Note</>}
        </Button>
      </div>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <Textarea placeholder="What did the vendor say?" value={note} onChange={e => setNote(e.target.value)} rows={4} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button onClick={saveNote} disabled={!note.trim()}>Save Note</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
