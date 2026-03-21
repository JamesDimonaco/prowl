import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const MAX_CONCURRENT_CHECKS = 5;
const FULL_REEXTRACT_EVERY = 100;
const MIN_TEXT_LENGTH_FOR_REEXTRACT = 500;

/** Query monitors that are due for a check */
export const getMonitorsDue = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get active monitors where nextCheckAt <= now
    const allActive = await ctx.db
      .query("monitors")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return allActive
      .filter((m) => m.nextCheckAt && m.nextCheckAt <= now)
      .slice(0, MAX_CONCURRENT_CHECKS);
  },
});

/** Record the result of a scheduled check */
export const recordCheckResult = internalMutation({
  args: {
    monitorId: v.id("monitors"),
    hasNewMatches: v.boolean(),
    matchCount: v.number(),
    totalItems: v.number(),
    matches: v.array(v.any()),
    schema: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(args.monitorId);
    if (!monitor) return;
    // Don't update paused or scanning monitors
    if (monitor.status !== "active") return;

    const now = Date.now();

    if (args.error) {
      const retryCount = (monitor.retryCount ?? 0) + 1;
      if (retryCount >= 3) {
        await ctx.db.patch(args.monitorId, {
          status: "error",
          lastError: args.error,
          retryCount,
          nextCheckAt: undefined,
          updatedAt: now,
        });
      } else {
        const backoffMs = Math.pow(4, retryCount) * 30_000;
        await ctx.db.patch(args.monitorId, {
          lastError: args.error,
          retryCount,
          nextCheckAt: now + backoffMs,
          updatedAt: now,
        });
      }
      return;
    }

    // Success
    const intervalMs = intervalToMs(monitor.checkInterval);
    const updates: Record<string, unknown> = {
      status: "active",
      matchCount: args.matchCount,
      checkCount: (monitor.checkCount ?? 0) + 1,
      retryCount: 0,
      lastCheckedAt: now,
      nextCheckAt: now + intervalMs,
      updatedAt: now,
      lastError: undefined,
    };

    if (args.matchCount > 0) {
      updates.lastMatchAt = now;
    }

    // If a full re-extract returned a new schema, update it
    if (args.schema) {
      updates.schema = args.schema;
    }

    await ctx.db.patch(args.monitorId, updates);

    // Store the scrape result
    await ctx.db.insert("scrapeResults", {
      monitorId: args.monitorId,
      matches: args.matches,
      totalItems: args.totalItems,
      hasNewMatches: args.hasNewMatches,
      scrapedAt: now,
    });
  },
});

function intervalToMs(interval: string): number {
  const map: Record<string, number> = {
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "6h": 6 * 60 * 60_000,
    "24h": 24 * 60 * 60_000,
  };
  return map[interval] ?? 60 * 60_000;
}

/** The main scheduler action — called by cron, calls the scraper */
export const runScheduledChecks = internalAction({
  args: {},
  handler: async (ctx) => {
    const scraperUrl = process.env.SCRAPER_URL;
    const scraperKey = process.env.SCRAPER_API_KEY;

    if (!scraperUrl || !scraperKey) {
      console.error("[scheduler] SCRAPER_URL or SCRAPER_API_KEY not configured");
      return;
    }

    // Get monitors due for checking
    const monitors = await ctx.runQuery(internal.scheduler.getMonitorsDue);

    if (monitors.length === 0) return;

    console.log(`[scheduler] ${monitors.length} monitor(s) due for check`);

    // Process each monitor
    for (const monitor of monitors) {
      try {
        const checkCount = monitor.checkCount ?? 0;
        const needsReextract = checkCount > 0 && checkCount % FULL_REEXTRACT_EVERY === 0;

        if (needsReextract && monitor.schema) {
          // Full re-extract: call /api/extract with AI
          await runFullExtract(ctx, monitor, scraperUrl, scraperKey);
        } else {
          // Quick check: scrape + apply stored conditions, no AI
          await runQuickCheck(ctx, monitor, scraperUrl, scraperKey);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error(`[scheduler] Monitor ${monitor._id} failed:`, msg);

        await ctx.runMutation(internal.scheduler.recordCheckResult, {
          monitorId: monitor._id,
          hasNewMatches: false,
          matchCount: 0,
          totalItems: 0,
          matches: [],
          error: msg,
        });
      }
    }
  },
});

async function runQuickCheck(
  ctx: { runMutation: (ref: any, args: any) => Promise<any> },
  monitor: any,
  scraperUrl: string,
  scraperKey: string
) {
  const matchConditions = monitor.schema?.matchConditions ?? {};
  const blacklist: string[] = monitor.blacklistedItems ?? [];

  const res = await fetch(`${scraperUrl}/api/quick-check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": scraperKey,
    },
    body: JSON.stringify({
      url: monitor.url,
      matchConditions,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Scraper returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const result = await res.json();

  if (!result.accessible) {
    throw new Error("Page inaccessible");
  }

  // Determine match count considering blacklist
  const hasMatch = result.hasNewMatches;
  const matchCount = hasMatch ? 1 : 0; // Quick check is binary

  await ctx.runMutation(internal.scheduler.recordCheckResult, {
    monitorId: monitor._id,
    hasNewMatches: hasMatch,
    matchCount: hasMatch ? (monitor.matchCount ?? 0) + 1 : monitor.matchCount ?? 0,
    totalItems: 0,
    matches: hasMatch
      ? [{ quickCheck: true, keywordResults: result.keywordResults, priceResults: result.priceResults }]
      : [],
  });

  console.log(
    `[scheduler] Quick check ${monitor._id}: ${hasMatch ? "MATCH" : "no match"}`
  );
}

async function runFullExtract(
  ctx: { runMutation: (ref: any, args: any) => Promise<any> },
  monitor: any,
  scraperUrl: string,
  scraperKey: string
) {
  // First do a quick accessibility check
  const quickRes = await fetch(`${scraperUrl}/api/quick-check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": scraperKey,
    },
    body: JSON.stringify({
      url: monitor.url,
      matchConditions: monitor.schema?.matchConditions ?? {},
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (quickRes.ok) {
    const quickResult = await quickRes.json();
    if (!quickResult.accessible) {
      // Page is inaccessible — skip re-extract, keep existing schema
      console.log(`[scheduler] Skipping re-extract for ${monitor._id}: page inaccessible`);

      await ctx.runMutation(internal.scheduler.recordCheckResult, {
        monitorId: monitor._id,
        hasNewMatches: false,
        matchCount: monitor.matchCount ?? 0,
        totalItems: 0,
        matches: [],
        error: "Page inaccessible during re-extract — kept existing schema",
      });
      return;
    }
  }

  // Page is accessible, do the full AI extraction
  const res = await fetch(`${scraperUrl}/api/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": scraperKey,
    },
    body: JSON.stringify({
      url: monitor.url,
      prompt: monitor.prompt,
      name: monitor.name,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI extract failed ${res.status}: ${body.slice(0, 200)}`);
  }

  const result = await res.json();

  // Check confidence — if too low, skip schema update
  const confidence = result.schema?.insights?.confidence ?? 100;
  if (confidence <= 10 && (result.totalItems ?? 0) === 0) {
    console.log(`[scheduler] Re-extract for ${monitor._id}: low confidence (${confidence}%), keeping existing schema`);

    await ctx.runMutation(internal.scheduler.recordCheckResult, {
      monitorId: monitor._id,
      hasNewMatches: false,
      matchCount: monitor.matchCount ?? 0,
      totalItems: 0,
      matches: [],
      error: `Re-extract returned low confidence (${confidence}%) — kept existing schema`,
    });
    return;
  }

  const matchCount = result.matches?.length ?? 0;
  const totalItems = result.totalItems ?? 0;

  await ctx.runMutation(internal.scheduler.recordCheckResult, {
    monitorId: monitor._id,
    hasNewMatches: matchCount > 0,
    matchCount,
    totalItems,
    matches: result.matches ?? [],
    schema: result.schema,
  });

  console.log(
    `[scheduler] Full re-extract ${monitor._id}: ${totalItems} items, ${matchCount} matches, confidence ${confidence}%`
  );
}
