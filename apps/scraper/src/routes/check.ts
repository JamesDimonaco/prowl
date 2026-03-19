import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { scrapeUrl } from "../services/scraper.js";
import { extractWithAI, applyMatchConditions } from "../services/extractor.js";

const checkSchema = z.object({
  url: z.string().url(),
  schema: z.object({
    fields: z.record(z.string()),
    items: z.array(z.record(z.any())),
    matchConditions: z.object({
      titleContains: z.array(z.string()).optional(),
      titleExcludes: z.array(z.string()).optional(),
      priceMax: z.number().optional(),
      priceMin: z.number().optional(),
      mustInclude: z.array(z.string()).optional(),
      mustExclude: z.array(z.string()).optional(),
    }),
  }),
  prompt: z.string().optional(),
  timeout: z.number().optional(),
});

export const checkRoutes = new Hono();

checkRoutes.post("/", zValidator("json", checkSchema), async (c) => {
  const { url, schema, prompt, timeout } = c.req.valid("json");

  try {
    const scraped = await scrapeUrl(url, { timeout });

    // Re-extract items using AI to handle page structure changes
    const { schema: newSchema, matches } = await extractWithAI(
      scraped.text,
      prompt || `Extract items matching: ${JSON.stringify(schema.matchConditions)}`
    );

    // Also apply the original match conditions as a fallback
    const fallbackMatches = applyMatchConditions(newSchema.items, schema.matchConditions);

    // Use whichever found more matches (AI understanding vs strict conditions)
    const finalMatches = matches.length >= fallbackMatches.length ? matches : fallbackMatches;

    return c.json({
      url,
      matches: finalMatches,
      totalItems: newSchema.items.length,
      hasNewMatches: finalMatches.length > 0,
      scrapedAt: scraped.scrapedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check failed";
    return c.json({ error: "check_failed", message, statusCode: 500 }, 500);
  }
});
