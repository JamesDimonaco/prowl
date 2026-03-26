"use client";

import { authClient } from "@/lib/auth-client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useCallback } from "react";

export type Tier = "free" | "pro" | "business";

export const TIER_LIMITS: Record<Tier, {
  maxMonitors: number;
  minInterval: string;
  channels: string[];
  description: string;
  allowedIntervals: string[];
}> = {
  free: {
    maxMonitors: 3,
    minInterval: "6h",
    channels: ["email"],
    description: "3 monitors, 6 hour checks, email only",
    allowedIntervals: ["6h", "24h"],
  },
  pro: {
    maxMonitors: 25,
    minInterval: "15m",
    channels: ["email", "telegram", "discord"],
    description: "25 monitors, 15 min checks, all channels",
    allowedIntervals: ["15m", "30m", "1h", "6h", "24h"],
  },
  business: {
    maxMonitors: 9999,
    minInterval: "5m",
    channels: ["email", "telegram", "discord", "webhook"],
    description: "Unlimited monitors, 5 min checks, API access",
    allowedIntervals: ["5m", "15m", "30m", "1h", "6h", "24h"],
  },
};

function detectTier(subscriptions: Array<Record<string, unknown>>): Tier {
  for (const sub of subscriptions) {
    const slug = String(sub.slug ?? sub.productSlug ?? "").toLowerCase();
    if (slug === "business") return "business";
    if (slug === "pro") return "pro";

    const name = String(sub.productName ?? sub.name ?? "").toLowerCase();
    if (name.includes("business")) return "business";
    if (name.includes("pro")) return "pro";
  }
  return "free";
}

interface TierInfo {
  tier: Tier;
  isLoading: boolean;
  maxMonitors: number;
  minInterval: string;
  channels: string[];
  description: string;
  allowedIntervals: string[];
  refetch: () => void;
}

export function useTier(): TierInfo {
  // Primary: Convex DB (reactive, instant)
  const convexTier = useQuery(api.tiers.get);
  const syncTier = useMutation(api.tiers.sync);

  const [polarTier, setPolarTier] = useState<Tier | null>(null);
  const [polarLoading, setPolarLoading] = useState(false);

  const tier: Tier = convexTier?.tier ?? polarTier ?? "free";
  const isLoading = convexTier === undefined && polarLoading;

  // Fetch tier from Polar and sync to Convex
  const fetchAndSync = useCallback(async () => {
    setPolarLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = authClient as any;
      const state = await client.customer?.state?.();

      if (state?.data) {
        const subs = state.data.activeSubscriptions ?? state.data.subscriptions ?? [];
        if (Array.isArray(subs) && subs.length > 0) {
          const detected = detectTier(subs);
          setPolarTier(detected);

          // Sync to Convex DB so server-side enforcement works
          if (detected !== (convexTier?.tier ?? "free")) {
            await syncTier({ tier: detected });
          }
        } else if (convexTier?.tier && convexTier.tier !== "free") {
          // User has no active subscriptions but Convex says they're paid
          // They may have canceled — sync back to free
          await syncTier({ tier: "free" });
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("useTier: failed to fetch from Polar", err);
      }
    } finally {
      setPolarLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convexTier?.tier]);

  // Fetch on mount
  useEffect(() => {
    fetchAndSync();
  }, [fetchAndSync]);

  // Refetch on window focus (user returns from checkout)
  useEffect(() => {
    function onFocus() { fetchAndSync(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchAndSync]);

  // Refetch on ?upgraded=true
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("upgraded=true")) {
      const timer = setTimeout(() => fetchAndSync(), 1500);
      return () => clearTimeout(timer);
    }
  }, [fetchAndSync]);

  return {
    tier,
    isLoading,
    refetch: fetchAndSync,
    ...TIER_LIMITS[tier],
  };
}
