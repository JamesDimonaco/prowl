import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { scrapeUrl } from "../services/scraper.js";
import { extractWithAI } from "../services/extractor.js";

const extractSchema = z.object({
  url: z.string().url(),
  prompt: z.string().min(1),
  timeout: z.number().optional(),
});

export const extractRoutes = new Hono();

extractRoutes.post("/", zValidator("json", extractSchema), async (c) => {
  const { url, prompt, timeout } = c.req.valid("json");

  try {
    const scraped = await scrapeUrl(url, { timeout });
    const { schema, matches } = await extractWithAI(scraped.text, prompt);

    return c.json({
      url,
      schema,
      matches,
      totalItems: schema.items.length,
      scrapedAt: scraped.scrapedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    return c.json({ error: "extract_failed", message, statusCode: 500 }, 500);
  }
});
