import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = parseInt(process.env.PORT || "3001");

console.log(`🐾 Prowl Scraper API starting on port ${port}`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🐾 Prowl Scraper API running at http://localhost:${info.port}`);
});
