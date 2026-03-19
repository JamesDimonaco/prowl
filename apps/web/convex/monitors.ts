import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("monitors")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("monitors") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    url: v.string(),
    prompt: v.string(),
    checkInterval: v.union(
      v.literal("5m"),
      v.literal("15m"),
      v.literal("30m"),
      v.literal("1h"),
      v.literal("6h"),
      v.literal("24h")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("monitors", {
      ...args,
      status: "active",
      matchCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("monitors"),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
    prompt: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("paused"),
        v.literal("error"),
        v.literal("matched")
      )
    ),
    checkInterval: v.optional(
      v.union(
        v.literal("5m"),
        v.literal("15m"),
        v.literal("30m"),
        v.literal("1h"),
        v.literal("6h"),
        v.literal("24h")
      )
    ),
    schema: v.optional(v.any()),
    lastCheckedAt: v.optional(v.number()),
    lastMatchAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    matchCount: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Monitor not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    await ctx.db.patch(id, updates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("monitors") },
  handler: async (ctx, { id }) => {
    // Delete associated scrape results
    const results = await ctx.db
      .query("scrapeResults")
      .withIndex("by_monitorId", (q) => q.eq("monitorId", id))
      .collect();
    for (const result of results) {
      await ctx.db.delete(result._id);
    }

    // Delete associated notifications
    const notifs = await ctx.db
      .query("notifications")
      .withIndex("by_monitorId", (q) => q.eq("monitorId", id))
      .collect();
    for (const notif of notifs) {
      await ctx.db.delete(notif._id);
    }

    await ctx.db.delete(id);
  },
});

export const getResults = query({
  args: { monitorId: v.id("monitors"), limit: v.optional(v.number()) },
  handler: async (ctx, { monitorId, limit }) => {
    const results = await ctx.db
      .query("scrapeResults")
      .withIndex("by_monitorId", (q) => q.eq("monitorId", monitorId))
      .order("desc")
      .take(limit ?? 20);
    return results;
  },
});

export const addResult = mutation({
  args: {
    monitorId: v.id("monitors"),
    matches: v.array(v.any()),
    totalItems: v.number(),
    hasNewMatches: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert("scrapeResults", {
      ...args,
      scrapedAt: now,
    });

    // Update monitor status
    const updates: Record<string, unknown> = {
      lastCheckedAt: now,
      updatedAt: now,
    };

    if (args.error) {
      updates.status = "error";
      updates.lastError = args.error;
    } else if (args.hasNewMatches) {
      updates.status = "matched";
      updates.lastMatchAt = now;
      const monitor = await ctx.db.get(args.monitorId);
      if (monitor) {
        updates.matchCount = monitor.matchCount + args.matches.length;
      }
    }

    await ctx.db.patch(args.monitorId, updates);
  },
});
