// Categorizes a batch of bank-transaction descriptions with GPT-5 nano,
// constrained to a strict JSON schema so the model can ONLY return one of
// the app's own fixed category names — it can never invent a new category
// or return free text. That constraint is deliberate: an AI guess is only
// useful here if it's guaranteed to land inside a set of values the rest of
// the app already knows how to handle.
//
// This never auto-applies anything by itself — it's called from the CSV
// import review screen, which still shows every row (with the AI's guess
// pre-filled) for the user to check and override before anything is
// imported. Nothing here writes to the database directly.
//
// Requires the OPENAI_API_KEY secret on this Supabase project
// (Project Settings -> Edge Functions -> Secrets). Without it configured,
// this returns a clear error and the app falls back to its keyword-based
// guesses — it never blocks the import.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const EXPENSE_CATEGORIES = [
  "Housing",
  "Groceries",
  "Transport",
  "Subscriptions",
  "Entertainment",
  "Utilities",
  "Savings",
  "Other",
];
const INCOME_CATEGORIES = [
  "Salary/Wages",
  "Side hustle/Freelance",
  "Centrelink/Government payment",
  "Investment/Interest",
  "Gift",
  "Other",
];
const ALL_CATEGORIES = Array.from(new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]));

interface Item {
  id: string;
  description: string;
  type: "income" | "expense";
}

// The app calls this from a browser (both the Artifact preview and the EAS
// web build run as plain web pages), so the browser sends a CORS preflight
// OPTIONS request before the real POST — missing Access-Control-Allow-
// Methods here made that preflight fail, which silently killed every call
// before it ever reached this function (no request ever reached OpenAI,
// which is exactly what an empty usage dashboard looks like).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured on this project" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let items: Item[];
  try {
    const body = await req.json();
    items = body.items;
    if (!Array.isArray(items) || items.length === 0) throw new Error("empty");
    if (items.length > 100) throw new Error("too many items — send at most 100 per call");
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Expected { items: [{ id, description, type }] } — ${e instanceof Error ? e.message : "invalid body"}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const schema = {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            category: { type: "string", enum: ALL_CATEGORIES },
          },
          required: ["id", "category"],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  };

  const prompt = items
    .map((it) => {
      const allowed = it.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      return `id=${it.id} allowed=[${allowed.join(", ")}] description="${it.description.replace(/"/g, "'")}"`;
    })
    .join("\n");

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-5-nano",
        messages: [
          {
            role: "system",
            content:
              "You categorize Australian bank transaction descriptions for a personal budgeting app. For each line, pick exactly ONE category from that line's own 'allowed' list — never a category outside it, never a new one. Match by what the merchant/description actually is (e.g. a supermarket chain is Groceries, a streaming or app-store billing line is Subscriptions, a one-off bank fee or internal transfer with no merchant name is Other).",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_schema", json_schema: { name: "categorization", strict: true, schema } },
      }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `Could not reach OpenAI: ${e instanceof Error ? e.message : "network error"}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!openaiRes.ok) {
    const text = await openaiRes.text();
    return new Response(JSON.stringify({ error: `OpenAI error (${openaiRes.status}): ${text}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await openaiRes.json();
  const content = data.choices?.[0]?.message?.content;
  let parsed: { results?: { id: string; category: string }[] };
  try {
    parsed = JSON.parse(content ?? "{}");
  } catch {
    return new Response(JSON.stringify({ error: "Model returned unparseable JSON" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Belt-and-braces: even with a strict schema, only trust a result whose
  // category is actually in that item's own allowed list — never let a
  // stray value reach the app's data.
  const byId = new Map(items.map((it) => [it.id, it]));
  const safeResults = (parsed.results || []).filter((r) => {
    const item = byId.get(r.id);
    if (!item) return false;
    const allowed = item.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return allowed.includes(r.category);
  });

  return new Response(JSON.stringify({ results: safeResults }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
