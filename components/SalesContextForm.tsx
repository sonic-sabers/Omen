import type { SalesContext } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SalesContextForm({
  salesContext,
  onChange,
  running = false,
}: {
  salesContext: SalesContext;
  onChange: (value: SalesContext) => void;
  running?: boolean;
}) {
  return (
    <Card className="mt-4 border-primary/20 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">About your product</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="grid gap-1">
          <Label htmlFor="seller-company" className="text-xs">
            Your company name
          </Label>
          <Input
            id="seller-company"
            value={salesContext.sellerCompany}
            onChange={(e) =>
              onChange({ ...salesContext, sellerCompany: e.target.value })
            }
            placeholder="Seller company"
            disabled={running}
            className="h-8 text-xs"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="offering" className="text-xs">
            What do you sell?
          </Label>
          <Textarea
            id="offering"
            value={salesContext.offering}
            onChange={(e) =>
              onChange({ ...salesContext, offering: e.target.value })
            }
            placeholder="e.g. A tool that helps sales teams send better emails"
            disabled={running}
            className="min-h-16 text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
}
