import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const tierValidator = v.union(v.literal("free"), v.literal("pro"), v.literal("business"));

/** Get the current user's tier */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { tier: "free" as const };

    const record = await ctx.db
      .query("userTiers")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();

    return { tier: (record?.tier ?? "free") as "free" | "pro" | "business" };
  },
});

/** Sync the user's tier from client (called after checkout or on page load) */
export const sync = mutation({
  args: {
    tier: tierValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const existing = await ctx.db
      .query("userTiers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userTiers", {
        userId,
        tier: args.tier,
        updatedAt: Date.now(),
      });
    }
  },
});

/** Internal mutation for webhook-triggered tier updates */
export const update = internalMutation({
  args: {
    userId: v.string(),
    tier: tierValidator,
    polarCustomerId: v.optional(v.string()),
    polarSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userTiers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        polarCustomerId: args.polarCustomerId,
        polarSubscriptionId: args.polarSubscriptionId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userTiers", {
        userId: args.userId,
        tier: args.tier,
        polarCustomerId: args.polarCustomerId,
        polarSubscriptionId: args.polarSubscriptionId,
        updatedAt: Date.now(),
      });
    }
  },
});
