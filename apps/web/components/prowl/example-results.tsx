import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, TrendingDown, Zap, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

const EXAMPLE_ITEMS = [
  { title: "MacBook Pro 14\" M3 Pro — Refurbished", price: "$1,399", matched: true },
  { title: "MacBook Pro 16\" M3 Max — Refurbished", price: "$2,149", matched: false },
  { title: "MacBook Pro 14\" M3 — Refurbished", price: "$1,099", matched: true },
  { title: "MacBook Pro 16\" M3 Pro — Refurbished", price: "$1,899", matched: false },
  { title: "MacBook Pro 14\" M3 Pro 18GB — Refurbished", price: "$1,479", matched: true },
];

export function ExampleResults() {
  return (
    <div className="mx-auto mt-16 sm:mt-20 max-w-4xl">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
          See what PageAlert finds
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Here&apos;s a real example — AI extracts items, highlights matches, and tracks price changes
        </p>
      </div>

      <div className="rounded-xl border border-border/30 bg-card/50 shadow-lg shadow-black/5 overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/20 px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold">MacBook Pro Refurbished</h3>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">3 matches</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                &ldquo;MacBook Pro under $1500&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-primary" />
                92%
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                12s
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 border-b border-border/20 text-center">
          <div className="py-3 border-r border-border/20">
            <p className="text-lg font-bold">5</p>
            <p className="text-[10px] text-muted-foreground">Items</p>
          </div>
          <div className="py-3 border-r border-border/20">
            <p className="text-lg font-bold text-primary">3</p>
            <p className="text-[10px] text-muted-foreground">Matches</p>
          </div>
          <div className="py-3">
            <p className="text-lg font-bold flex items-center justify-center gap-1">
              <TrendingDown className="h-4 w-4 text-emerald-400" />2
            </p>
            <p className="text-[10px] text-muted-foreground">Price drops</p>
          </div>
        </div>

        {/* Items */}
        <div className="px-4 sm:px-6 py-4 space-y-1.5">
          {EXAMPLE_ITEMS.map((item, i) => (
            <div
              key={i}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm ${
                item.matched
                  ? "bg-emerald-500/5 border border-emerald-500/15"
                  : "bg-muted/20"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {item.matched && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                <span className={`truncate text-xs sm:text-sm ${item.matched ? "font-medium" : "text-muted-foreground"}`}>
                  {item.title}
                </span>
              </div>
              <span className={`text-xs sm:text-sm font-bold shrink-0 ${item.matched ? "text-emerald-400" : ""}`}>
                {item.price}
              </span>
            </div>
          ))}
        </div>

        {/* Footer with link */}
        <div className="border-t border-border/20 px-4 sm:px-6 py-3 bg-muted/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Example results from a real scan
          </p>
          <Link
            href="/try/example"
            className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
          >
            See full example
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
