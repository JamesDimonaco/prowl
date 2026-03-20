import Anthropic from "@anthropic-ai/sdk";
import type { ExtractionSchema, ExtractedItem } from "@prowl/shared";

const getClient = () => new Anthropic();

const EXTRACTION_PROMPT = `You are a web data extraction assistant. Given the text content of a web page and a user's description of what they're looking for, your job is to:

1. Identify the repeating items/products/listings on the page
2. Extract structured data for each item
3. Determine which items match the user's criteria

Respond with ONLY valid JSON in this exact format:
{
  "fields": {
    "title": "description of the title field",
    "price": "description of the price field",
    ...other relevant fields
  },
  "items": [
    { "title": "...", "price": 1299, ...other fields },
    ...all items found on the page
  ],
  "matchConditions": {
    "titleContains": ["keywords", "that", "must", "appear"],
    "titleExcludes": ["keywords", "to", "exclude"],
    "priceMax": 1500,
    "priceMin": 0,
    "mustInclude": ["other", "required", "terms"],
    "mustExclude": ["other", "excluded", "terms"]
  }
}

Rules:
- Extract ALL items on the page, not just matches
- Prices should be numbers (no currency symbols)
- Include all fields that seem relevant for the item type
- matchConditions should reflect the user's stated criteria
- If you can't determine a field value, use null`;

export async function extractWithAI(
  pageText: string,
  prompt: string
): Promise<{ schema: ExtractionSchema; matches: ExtractedItem[] }> {
  const client = getClient();

  // Truncate page text if too long (keep under ~100k chars for token limits)
  const truncatedText = pageText.length > 100000 ? pageText.slice(0, 100000) + "\n...[truncated]" : pageText;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Page content:\n\n${truncatedText}\n\nUser is looking for: ${prompt}`,
      },
    ],
    system: EXTRACTION_PROMPT,
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";

  console.log("[extractor] AI response length:", responseText.length);
  console.log("[extractor] AI response preview:", responseText.slice(0, 300));

  // Try to extract JSON from the response using multiple strategies
  const jsonString = extractJson(responseText);
  if (!jsonString) {
    console.error("[extractor] No JSON found in AI response:", responseText.slice(0, 1000));
    throw new Error("AI returned no extractable JSON");
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(jsonString);
  } catch (e) {
    console.error("[extractor] JSON parse failed:", (e as Error).message);
    console.error("[extractor] Attempted to parse:", jsonString.slice(0, 500));
    throw new Error("AI returned invalid JSON");
  }

  // Normalise into our expected schema shape - be lenient about what AI returns
  const parsed: ExtractionSchema = {
    fields: (raw.fields as Record<string, string>) ?? {},
    items: Array.isArray(raw.items) ? raw.items : [],
    matchConditions: {
      titleContains: getStringArray(raw.matchConditions, "titleContains"),
      titleExcludes: getStringArray(raw.matchConditions, "titleExcludes"),
      priceMax: getNumber(raw.matchConditions, "priceMax"),
      priceMin: getNumber(raw.matchConditions, "priceMin"),
      mustInclude: getStringArray(raw.matchConditions, "mustInclude"),
      mustExclude: getStringArray(raw.matchConditions, "mustExclude"),
    },
  };

  console.log("[extractor] Parsed %d items, %d fields", parsed.items.length, Object.keys(parsed.fields).length);

  const matches = applyMatchConditions(parsed.items, parsed.matchConditions);
  console.log("[extractor] Found %d matches out of %d items", matches.length, parsed.items.length);

  return { schema: parsed, matches };
}

/** Try multiple strategies to extract a JSON string from AI response text */
function extractJson(text: string): string | null {
  const trimmed = text.trim();

  // Strategy 1: Already valid JSON
  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  // Strategy 2: Extract from markdown code fences (greedy to get the full block)
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*)\n\s*```/);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  // Strategy 3: Find outermost { } braces
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

function getStringArray(obj: unknown, key: string): string[] | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const val = (obj as Record<string, unknown>)[key];
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === "string");
  return undefined;
}

function getNumber(obj: unknown, key: string): number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const val = (obj as Record<string, unknown>)[key];
  if (typeof val === "number") return val;
  return undefined;
}

export function applyMatchConditions(items: ExtractedItem[], conditions: ExtractionSchema["matchConditions"]): ExtractedItem[] {
  return items.filter((item) => {
    const title = String(item.title || "").toLowerCase();
    const price = typeof item.price === "number" ? item.price : parseFloat(String(item.price || "0"));

    if (conditions.titleContains?.length) {
      const hasAll = conditions.titleContains.every((kw) => title.includes(kw.toLowerCase()));
      if (!hasAll) return false;
    }

    if (conditions.titleExcludes?.length) {
      const hasExcluded = conditions.titleExcludes.some((kw) => title.includes(kw.toLowerCase()));
      if (hasExcluded) return false;
    }

    if (conditions.priceMax !== undefined && price > conditions.priceMax) return false;
    if (conditions.priceMin !== undefined && price < conditions.priceMin) return false;

    if (conditions.mustInclude?.length) {
      const itemStr = JSON.stringify(item).toLowerCase();
      const hasAll = conditions.mustInclude.every((kw) => itemStr.includes(kw.toLowerCase()));
      if (!hasAll) return false;
    }

    if (conditions.mustExclude?.length) {
      const itemStr = JSON.stringify(item).toLowerCase();
      const hasExcluded = conditions.mustExclude.some((kw) => itemStr.includes(kw.toLowerCase()));
      if (hasExcluded) return false;
    }

    return true;
  });
}
