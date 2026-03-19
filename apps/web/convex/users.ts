import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByBetterAuthId = query({
  args: { betterAuthId: v.string() },
  handler: async (ctx, { betterAuthId }) => {
    return ctx.db
      .query("users")
      .withIndex("by_betterAuthId", (q) => q.eq("betterAuthId", betterAuthId))
      .unique();
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    betterAuthId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_betterAuthId", (q) =>
        q.eq("betterAuthId", args.betterAuthId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        image: args.image,
      });
      return existing._id;
    }

    return ctx.db.insert("users", {
      ...args,
      tier: "free",
      createdAt: Date.now(),
    });
  },
});
