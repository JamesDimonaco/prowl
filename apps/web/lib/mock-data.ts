// Mock data for development before Convex is connected
// This will be replaced with real Convex queries

export interface MockMonitor {
  _id: string;
  name: string;
  url: string;
  prompt: string;
  status: "active" | "paused" | "error" | "matched";
  checkInterval: "5m" | "15m" | "30m" | "1h" | "6h" | "24h";
  lastCheckedAt?: number;
  lastMatchAt?: number;
  lastError?: string;
  matchCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface MockUser {
  _id: string;
  email: string;
  name: string;
  image?: string;
  tier: "free" | "pro" | "business";
}

export const mockUser: MockUser = {
  _id: "user_1",
  email: "james@example.com",
  name: "James",
  tier: "free",
};

const now = Date.now();
const hour = 3600000;

export const mockMonitors: MockMonitor[] = [
  {
    _id: "mon_1",
    name: "MacBook Pro M3 Refurbished",
    url: "https://apple.com/shop/refurbished/mac",
    prompt: "MacBook Pro 14 inch M3 gray under $1500",
    status: "active",
    checkInterval: "1h",
    lastCheckedAt: now - hour * 0.5,
    matchCount: 0,
    createdAt: now - hour * 48,
    updatedAt: now - hour * 0.5,
  },
  {
    _id: "mon_2",
    name: "PS5 Pro Stock",
    url: "https://store.playstation.com",
    prompt: "PS5 Pro console in stock",
    status: "matched",
    checkInterval: "15m",
    lastCheckedAt: now - hour * 0.1,
    lastMatchAt: now - hour * 0.1,
    matchCount: 3,
    createdAt: now - hour * 72,
    updatedAt: now - hour * 0.1,
  },
  {
    _id: "mon_3",
    name: "Nike Dunk Low Panda Restock",
    url: "https://nike.com/w/dunk-shoes",
    prompt: "Nike Dunk Low Panda in size 10",
    status: "paused",
    checkInterval: "6h",
    lastCheckedAt: now - hour * 24,
    matchCount: 1,
    createdAt: now - hour * 168,
    updatedAt: now - hour * 24,
  },
  {
    _id: "mon_4",
    name: "GPU Price Drop",
    url: "https://newegg.com/GPUs/Category",
    prompt: "RTX 4070 Ti under $600",
    status: "error",
    checkInterval: "6h",
    lastCheckedAt: now - hour * 2,
    lastError: "Page structure changed - re-extraction needed",
    matchCount: 0,
    createdAt: now - hour * 96,
    updatedAt: now - hour * 2,
  },
];

export interface MockScrapeResult {
  _id: string;
  monitorId: string;
  matches: Record<string, unknown>[];
  totalItems: number;
  hasNewMatches: boolean;
  scrapedAt: number;
  error?: string;
}

export const mockResults: MockScrapeResult[] = [
  {
    _id: "res_1",
    monitorId: "mon_2",
    matches: [
      { title: "PS5 Pro Console", price: 699, inStock: true },
      { title: "PS5 Pro Digital Edition", price: 599, inStock: true },
    ],
    totalItems: 8,
    hasNewMatches: true,
    scrapedAt: now - hour * 0.1,
  },
  {
    _id: "res_2",
    monitorId: "mon_2",
    matches: [],
    totalItems: 8,
    hasNewMatches: false,
    scrapedAt: now - hour * 0.35,
  },
  {
    _id: "res_3",
    monitorId: "mon_1",
    matches: [],
    totalItems: 24,
    hasNewMatches: false,
    scrapedAt: now - hour * 0.5,
  },
];
