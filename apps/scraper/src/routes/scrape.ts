import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { scrapeUrl } from "../services/scraper.js";

const scrapeSchema = z.object({
  url: z.string().url(),
  timeout: z.number().optional(),
  waitFor: z.string().optional(),
});

export const scrapeRoutes = new Hono();

scrapeRoutes.post("/", zValidator("json", scrapeSchema), async (c) => {
  const { url, timeout, waitFor } = c.req.valid("json");

  try {
    const result = await scrapeUrl(url, { timeout, waitFor });
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    return c.json({ error: "scrape_failed", message, statusCode: 500 }, 500);
  }
});
