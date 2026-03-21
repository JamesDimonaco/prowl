"use client";

import { use, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/prowl/status-badge";
import { MatchConditionsEditor } from "@/components/prowl/match-conditions-editor";
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  Globe,
  Zap,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMonitor, useMonitorResults, useMonitors } from "@/hooks/use-monitors";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DeleteDialog } from "@/components/prowl/delete-dialog";
import { applyMatchConditions } from "@prowl/shared";
import type { Id } from "@/convex/_generated/dataModel";
import type { MatchConditions, ExtractedItem, ExtractionSchema } from "@prowl/shared";
import { toast } from "sonner";

function timeAgo(timestamp?: number): string {
  if (!timestamp) return "Never";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function MonitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const monitor = useMonitor(id as Id<"monitors">);
  const results = useMonitorResults(id as Id<"monitors">);
  const { togglePause, deleteMonitor } = useMonitors();
  const updateMutation = useMutation(api.monitors.update);
  const router = useRouter();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editedConditions, setEditedConditions] = useState<MatchConditions | null>(null);
  const [saving, setSaving] = useState(false);

  if (monitor === undefined) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (monitor === null) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <p className="text-lg font-semibold mb-2">Monitor not found</p>
        <Link href="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  const schema = monitor.schema as ExtractionSchema | undefined;
  const allItems = (schema?.items ?? []) as ExtractedItem[];
  const conditions = editedConditions ?? schema?.matchConditions ?? {};
  const matches = allItems.length > 0 ? applyMatchConditions(allItems, conditions) : [];
  const hasEdits = editedConditions !== null;

  async function saveConditions() {
    if (!schema || !editedConditions) return;
    setSaving(true);
    try {
      await updateMutation({
        id: id as Id<"monitors">,
        schema: { ...schema, matchConditions: editedConditions },
      });
      setEditedConditions(null);
      toast.success("Filters updated");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{monitor.name}</h1>
            <StatusBadge status={monitor.status} />
          </div>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            &ldquo;{monitor.prompt}&rdquo;
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              togglePause(id as Id<"monitors">);
              toast.success(monitor.status === "paused" ? "Monitor resumed" : "Monitor paused");
            }}
          >
            {monitor.status === "paused" ? (
              <><Play className="h-3.5 w-3.5" /> Resume</>
            ) : (
              <><Pause className="h-3.5 w-3.5" /> Pause</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/30 bg-card/50 shadow-sm shadow-black/5">
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> URL
            </div>
            <a
              href={monitor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"
            >
              {new URL(monitor.url).hostname}
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
        <Card className="border-border/30 bg-card/50 shadow-sm shadow-black/5">
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Interval
            </div>
            <p className="text-sm font-semibold">Every {monitor.checkInterval}</p>
          </CardContent>
        </Card>
        <Card className="border-border/30 bg-card/50 shadow-sm shadow-black/5">
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Matches
            </div>
            <p className="text-sm font-semibold">{matches.length} of {allItems.length} items</p>
          </CardContent>
        </Card>
        <Card className="border-border/30 bg-card/50 shadow-sm shadow-black/5">
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Last Check
            </div>
            <p className="text-sm font-semibold">{timeAgo(monitor.lastCheckedAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Match Filters */}
      {schema && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Match Filters</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Edit these to change what the monitor looks for
              </p>
            </div>
            {hasEdits && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={saveConditions}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Changes
              </Button>
            )}
          </div>
          <Card className="border-border/30 bg-card/50 shadow-sm shadow-black/5">
            <CardContent className="p-6">
              <MatchConditionsEditor
                conditions={conditions}
                onChange={setEditedConditions}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Extracted Items */}
      {allItems.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-bold tracking-tight">Extracted Items</h2>
            <Badge variant="outline" className="text-xs">{allItems.length} total</Badge>
            {matches.length > 0 && (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                {matches.length} match{matches.length !== 1 ? "es" : ""}
              </Badge>
            )}
          </div>

          {/* Show matches first */}
          <div className="space-y-2">
            {[...allItems]
              .sort((a, b) => {
                const aMatch = matches.some((m) => JSON.stringify(m) === JSON.stringify(a));
                const bMatch = matches.some((m) => JSON.stringify(m) === JSON.stringify(b));
                return aMatch === bMatch ? 0 : aMatch ? -1 : 1;
              })
              .map((item, i) => {
                const isMatch = matches.some(
                  (m) => JSON.stringify(m) === JSON.stringify(item)
                );
                return (
                  <Card
                    key={i}
                    className={`border-border/30 shadow-sm shadow-black/5 transition-colors ${
                      isMatch
                        ? "bg-emerald-500/5 border-l-2 border-l-emerald-500/40"
                        : "bg-card/30 opacity-50"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {String(item.title ?? item.name ?? `Item ${i + 1}`)}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            {item.price != null && (
                              <span className="text-sm font-semibold">
                                ${Number(item.price).toLocaleString()}
                              </span>
                            )}
                            {item.originalPrice != null && (
                              <span className="text-xs text-muted-foreground line-through">
                                ${Number(item.originalPrice).toLocaleString()}
                              </span>
                            )}
                            {item.savings != null && Number(item.savings) > 0 && (
                              <span className="text-xs text-emerald-400 font-medium">
                                Save ${Number(item.savings).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        {isMatch && (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs shrink-0">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Match
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Scrape History */}
      {results.length > 0 && (
        <div>
          <h2 className="text-lg font-bold tracking-tight mb-4">Scrape History</h2>
          <div className="space-y-3">
            {results.map((result) => (
              <Card key={result._id} className="border-border/30 bg-card/50 shadow-sm shadow-black/5">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {result.hasNewMatches ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        </div>
                      ) : result.error ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
                          <XCircle className="h-4 w-4 text-red-400" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {result.hasNewMatches
                            ? `${result.matches.length} match${result.matches.length !== 1 ? "es" : ""} found`
                            : result.error
                              ? "Scrape failed"
                              : "No matches"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(result.scrapedAt).toLocaleString()} · {result.totalItems} items
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          deleteMonitor(id as Id<"monitors">);
          toast.success("Monitor deleted");
          router.push("/dashboard");
        }}
        monitorName={monitor.name}
      />
    </div>
  );
}
