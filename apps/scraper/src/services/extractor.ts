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

  // Parse JSON from response - try multiple strategies
  let parsed: ExtractionSchema;
  try {
    // Strategy 1: Try parsing the raw response directly
    parsed = JSON.parse(responseText.trim()) as ExtractionSchema;
  } catch {
    // Strategy 2: Extract from markdown code fences
    const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch?.[1]) {
      try {
        parsed = JSON.parse(fenceMatch[1].trim()) as ExtractionSchema;
      } catch {
        // Strategy 3: Find the first { and last } in the response
        const firstBrace = responseText.indexOf("{");
        const lastBrace = responseText.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(responseText.slice(firstBrace, lastBrace + 1)) as ExtractionSchema;
        } else {
          console.error("[extractor] Could not parse AI response:", responseText.slice(0, 500));
          throw new Error("AI returned invalid JSON - try a simpler prompt");
        }
      }
    } else {
      // Strategy 3: Find the first { and last } in the response
      const firstBrace = responseText.indexOf("{");
      const lastBrace = responseText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(responseText.slice(firstBrace, lastBrace + 1)) as ExtractionSchema;
      } else {
        console.error("[extractor] Could not parse AI response:", responseText.slice(0, 500));
        throw new Error("AI returned invalid JSON - try a simpler prompt");
      }
    }
  }

  // Apply match conditions to find matching items
  const matches = applyMatchConditions(parsed.items, parsed.matchConditions);

  return { schema: parsed, matches };
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
