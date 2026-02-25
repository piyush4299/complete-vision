import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

const statusStyles: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  sent: "bg-status-sent-bg text-status-sent",
  skipped: "bg-status-skipped-bg text-status-skipped",
  followed_up: "bg-status-followed-bg text-status-followed",
  contacted: "bg-blue-100 text-blue-700",
  in_progress: "bg-blue-100 text-blue-700",
  interested: "bg-purple-100 text-purple-700",
  not_interested: "bg-red-100 text-red-700",
  maybe_later: "bg-red-100 text-red-700",
  declined: "bg-red-100 text-red-700",
  exhausted: "bg-muted text-muted-foreground line-through opacity-60",
  converted: "bg-emerald-100 text-emerald-700",
  invalid: "bg-gray-100 text-gray-500 line-through opacity-60",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  sent: "Sent",
  skipped: "Skipped",
  followed_up: "Followed Up",
  contacted: "Contacted",
  in_progress: "Contacted",
  interested: "Interested",
  not_interested: "Not Interested",
  maybe_later: "Not Interested",
  declined: "Not Interested",
  exhausted: "Exhausted",
  converted: "Converted",
  invalid: "Removed",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status === "converted" && <CheckCircle2 className="h-3 w-3" />}
      {statusLabels[status] ?? status}
    </span>
  );
}
