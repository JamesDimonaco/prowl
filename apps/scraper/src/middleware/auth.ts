import type { Context, Next } from "hono";

export async function authMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header("x-api-key");
  const expectedKey = process.env.SCRAPER_API_KEY;

  // In development, skip auth if no key is configured
  if (!expectedKey) {
    return next();
  }

  if (!apiKey || apiKey !== expectedKey) {
    return c.json({ error: "unauthorized", message: "Invalid or missing API key", statusCode: 401 }, 401);
  }

  return next();
}
