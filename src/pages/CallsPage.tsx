import { Card, CardContent } from "@/components/ui/card";
import { Phone } from "lucide-react";

export default function CallsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">📞 Calls</h1>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Phone className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">Coming Soon</h2>
            <p className="text-muted-foreground max-w-md">
              AI Voice Agent integration coming soon. Vendors with phone numbers will be eligible for automated calls.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
