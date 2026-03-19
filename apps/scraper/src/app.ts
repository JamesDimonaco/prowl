import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { scrapeRoutes } from "./routes/scrape.js";
import { extractRoutes } from "./routes/extract.js";
import { checkRoutes } from "./routes/check.js";
import { authMiddleware } from "./middleware/auth.js";

export const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "prowl-scraper", timestamp: new Date().toISOString() });
});

// API key auth for all /api routes
const api = new Hono();
api.use("*", authMiddleware);
api.route("/scrape", scrapeRoutes);
api.route("/extract", extractRoutes);
api.route("/check", checkRoutes);

app.route("/api", api);
