import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronDown } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

export type DateRange =
  | { mode: "preset"; days: number }
  | { mode: "custom"; startDate: string; endDate: string };

export interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const PRESETS: { label: string; days: number }[] = [
  { label: "30 Days",  days: 30  },
  { label: "60 Days",  days: 60  },
  { label: "90 Days",  days: 90  },
  { label: "1 Year",   days: 365 },
];

export function dateRangeToParams(range: DateRange): Record<string, string> {
  if (range.mode === "preset") {
    return { days: String(range.days) };
  }
  return { startDate: range.startDate, endDate: range.endDate };
}

export function dateRangeLabel(range: DateRange): string {
  if (range.mode === "preset") {
    return PRESETS.find((p) => p.days === range.days)?.label ?? `${range.days} Days`;
  }
  const from = range.startDate ? format(new Date(range.startDate), "MMM d, yyyy") : "Start";
  const to   = range.endDate   ? format(new Date(range.endDate),   "MMM d, yyyy") : "End";
  return `${from} → ${to}`;
}

export const DEFAULT_DATE_RANGE: DateRange = { mode: "preset", days: 30 };

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  const [localStart, setLocalStart] = useState(
    value.mode === "custom" ? value.startDate : format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [localEnd, setLocalEnd] = useState(
    value.mode === "custom" ? value.endDate : today
  );

  const applyCustom = () => {
    if (!localStart || !localEnd) return;
    onChange({ mode: "custom", startDate: localStart, endDate: localEnd });
    setCustomOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {PRESETS.map((p) => {
        const active = value.mode === "preset" && value.days === p.days;
        return (
          <Button
            key={p.days}
            size="sm"
            variant={active ? "default" : "outline"}
            className={cn(
              "h-8 px-3 text-xs font-medium",
              active
                ? "shadow-none"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onChange({ mode: "preset", days: p.days })}
          >
            {p.label}
          </Button>
        );
      })}

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={value.mode === "custom" ? "default" : "outline"}
            className={cn(
              "h-8 px-3 text-xs font-medium gap-1.5",
              value.mode !== "custom" && "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {value.mode === "custom" ? dateRangeLabel(value) : "Custom Range"}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4" align="end">
          <p className="text-sm font-semibold mb-3">Select Custom Range</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={localStart}
                max={localEnd || today}
                onChange={(e) => setLocalStart(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={localEnd}
                min={localStart}
                max={today}
                onChange={(e) => setLocalEnd(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setCustomOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={!localStart || !localEnd || localStart > localEnd}
              onClick={applyCustom}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
