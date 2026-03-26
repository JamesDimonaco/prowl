"use client";

import { authClient } from "@/lib/auth-client";
import { useQuery } from "convex/react";
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

// Product ID to tier mapping — set from env or hardcode after Polar setup
const PRODUCT_TIER_MAP: Record<string, Tier> = {};
if (typeof window !== "undefined") {
  // These could also come from a config endpoint
  // For now we match by product name/slug in the subscription data
}

function detectTier(subscriptions: Array<Record<string, unknown>>): Tier {
  for (const sub of subscriptions) {
    // Check by slug (set by Better Auth Polar plugin)
    const slug = String(sub.slug ?? sub.productSlug ?? "").toLowerCase();
    if (slug === "business") return "business";
    if (slug === "pro") return "pro";

    // Check by product ID
    const productId = String(sub.productId ?? "");
    if (PRODUCT_TIER_MAP[productId]) return PRODUCT_TIER_MAP[productId];

    // Check by product name
    const name = String(sub.productName ?? sub.name ?? "").toLowerCase();
    if (name.includes("business")) return "business";
    if (name.includes("pro")) return "pro";
  }
  return "free";
}

export function useTier(): TierInfo {
  // Primary source: Convex DB (updated by webhooks)
  const convexTier = useQuery(api.tiers.get);
  const [polarTier, setPolarTier] = useState<Tier | null>(null);
  const [polarLoading, setPolarLoading] = useState(false);

  // Use Convex tier if available, otherwise fall back to Polar API
  const tier: Tier = convexTier?.tier ?? polarTier ?? "free";
  const isLoading = convexTier === undefined && polarLoading;

  const fetchTier = useCallback(async () => {
    setPolarLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = authClient as any;
      const state = await client.customer?.state?.();

      if (state?.data) {
        const subs = state.data.activeSubscriptions ?? state.data.subscriptions ?? [];
        if (Array.isArray(subs) && subs.length > 0) {
          setPolarTier(detectTier(subs));
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("useTier: failed to fetch tier from Polar", err);
      }
    } finally {
      setPolarLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchTier();
  }, [fetchTier]);

  // Refetch when window regains focus (user returns from Polar checkout)
  useEffect(() => {
    function onFocus() {
      fetchTier();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchTier]);

  // Refetch if URL has ?upgraded=true (redirect from checkout)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("upgraded=true")) {
      // Small delay to let the webhook process
      const timer = setTimeout(() => fetchTier(), 2000);
      return () => clearTimeout(timer);
    }
  }, [fetchTier]);

  return {
    tier,
    isLoading,
    refetch: fetchTier,
    ...TIER_LIMITS[tier],
  };
}
