// ---- Scraper API Types ----

export interface ScrapeRequest {
  url: string;
  timeout?: number;
  waitFor?: string;
}

export interface ScrapeResponse {
  url: string;
  html: string;
  text: string;
  title: string;
  scrapedAt: string;
}

export interface ExtractRequest {
  url: string;
  prompt: string;
  timeout?: number;
}

export interface ExtractionSchema {
  fields: Record<string, string>;
  items: ExtractedItem[];
  matchConditions: MatchConditions;
}

export interface ExtractedItem {
  [key: string]: string | number | boolean | null;
}

export interface MatchConditions {
  titleContains?: string[];
  titleExcludes?: string[];
  priceMax?: number;
  priceMin?: number;
  mustInclude?: string[];
  mustExclude?: string[];
}

export interface ExtractResponse {
  url: string;
  schema: ExtractionSchema;
  matches: ExtractedItem[];
  totalItems: number;
  scrapedAt: string;
}

export interface CheckRequest {
  url: string;
  schema: ExtractionSchema;
  timeout?: number;
}

export interface CheckResponse {
  url: string;
  matches: ExtractedItem[];
  totalItems: number;
  hasNewMatches: boolean;
  scrapedAt: string;
}

// ---- Monitor Types ----

export type MonitorStatus = "active" | "paused" | "error" | "matched";

export type CheckInterval = "5m" | "15m" | "30m" | "1h" | "6h" | "24h";

export interface Monitor {
  id: string;
  userId: string;
  name: string;
  url: string;
  prompt: string;
  status: MonitorStatus;
  checkInterval: CheckInterval;
  schema?: ExtractionSchema;
  lastCheckedAt?: string;
  lastMatchAt?: string;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---- Notification Types ----

export type NotificationChannel = "email" | "telegram" | "discord";

export interface NotificationConfig {
  channel: NotificationChannel;
  enabled: boolean;
  target: string; // email address, telegram chat id, discord webhook url
}

// ---- API Error ----

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
