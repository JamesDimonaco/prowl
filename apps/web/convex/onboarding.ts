import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Onboarding email scheduler.
 *
 * Each new user gets four `onboardingEmails` rows queued at signup:
 * day0 (welcome, sent immediately), day1 (gentle nudge), day3 (3 starter
 * ideas), day7 (3 more ideas). An hourly cron processes due rows.
 *
 * In Phase 4 only the day0 send is wired up — day1/3/7 rows are queued so
 * the schema is stable, but the processor skips them. Phase 7 enables them.
 *
 * The whole sender is gated behind ONBOARDING_EMAILS_ENABLED=true so we
 * can land the wiring without auto-sending until James has reviewed the
 * day0 template. See PROWL-038 Phase 4.
 */

/**
 * Schedule a target time at 10:00 UTC `daysFromNow` days from now.
 * 10:00 UTC is a globally inoffensive hour: early evening in Asia,
 * mid-morning in Europe, early morning in the Americas. Not perfect,
 * but we don't track user timezones yet.
 */
function nextDayAt10UTC(daysFromNow: number): number {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(10, 0, 0, 0);
  return d.getTime();
}

/**
 * Idempotent — called from the user-create database hook in
 * convex/betterAuth/auth.ts. If anything is already queued for this
 * user we no-op (protects against retries, fixture imports, etc.).
 */
export const queueWelcomeSequence = internalMutation({
  args: { userId: v.string(), email: v.string() },
  handler: async (ctx, { userId, email }) => {
    const existing = await ctx.db
      .query("onboardingEmails")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) return;

    const now = Date.now();
    const rows: Array<{
      step: "day0" | "day1" | "day3" | "day7";
      scheduledFor: number;
    }> = [
      { step: "day0", scheduledFor: now },
      { step: "day1", scheduledFor: nextDayAt10UTC(1) },
      { step: "day3", scheduledFor: nextDayAt10UTC(3) },
      { step: "day7", scheduledFor: nextDayAt10UTC(7) },
    ];

    for (const row of rows) {
      await ctx.db.insert("onboardingEmails", {
        userId,
        email,
        step: row.step,
        scheduledFor: row.scheduledFor,
        status: "pending",
      });
    }

    // Kick the processor right away so the day0 email goes out without
    // waiting for the next hourly tick. The processor is internally
    // gated by ONBOARDING_EMAILS_ENABLED so this is safe even before
    // the kill switch is flipped.
    await ctx.scheduler.runAfter(0, internal.onboarding.processDueEmails, {});
  },
});

export const listDue = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("onboardingEmails")
      .withIndex("by_status_scheduledFor", (q) =>
        q.eq("status", "pending").lte("scheduledFor", Date.now())
      )
      .take(50);
  },
});

export const markSent = internalMutation({
  args: { id: v.id("onboardingEmails") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "sent", sentAt: Date.now() });
  },
});

export const markFailed = internalMutation({
  args: { id: v.id("onboardingEmails"), error: v.string() },
  handler: async (ctx, { id, error }) => {
    await ctx.db.patch(id, { status: "failed", error });
  },
});

/**
 * Hourly processor. Walks the pending queue and dispatches due emails.
 *
 * KILL SWITCH: gated by ONBOARDING_EMAILS_ENABLED. When unset (the
 * default during Phase 4 development) the queue still fills up but
 * nothing actually sends. Set to "true" in the Convex environment
 * once the day0 template is approved.
 *
 * Phase 4 only sends day0 — day1/3/7 are queued but skipped. Remove
 * the step guard in Phase 7.
 */
export const processDueEmails = internalAction({
  args: {},
  handler: async (ctx) => {
    const enabled = process.env.ONBOARDING_EMAILS_ENABLED === "true";
    if (!enabled) {
      console.log(
        "[onboarding] ONBOARDING_EMAILS_ENABLED is not 'true' — skipping send"
      );
      return;
    }

    const due = await ctx.runQuery(internal.onboarding.listDue, {});
    for (const row of due) {
      // Phase 4 ships day0 only. day1/3/7 are queued but the processor
      // skips them. They sit as `pending` until Phase 7 ships and the
      // guard below is removed.
      if (row.step !== "day0") continue;

      try {
        await ctx.runAction(internal.emails.sendOnboardingDay0, {
          to: row.email,
          userId: row.userId,
        });
        await ctx.runMutation(internal.onboarding.markSent, { id: row._id });
      } catch (e) {
        await ctx.runMutation(internal.onboarding.markFailed, {
          id: row._id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  },
});

/**
 * Dev-only manual trigger. Bypasses the kill switch so a developer
 * can email themselves to review the template:
 *
 *   npx convex run onboarding:sendWelcomeEmailNow \
 *     '{"to":"you@example.com","userId":"<your-user-id>"}'
 *
 * Does NOT touch the queue — this is a fire-and-forget test send.
 */
export const sendWelcomeEmailNow = internalAction({
  args: { to: v.string(), userId: v.string() },
  handler: async (ctx, { to, userId }) => {
    await ctx.runAction(internal.emails.sendOnboardingDay0, { to, userId });
  },
});

