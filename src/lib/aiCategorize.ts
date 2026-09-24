// Calls the `categorize-transactions` Supabase Edge Function to get an
// AI-guessed category for a batch of transaction descriptions, as a better
// second opinion on top of the plain keyword guesses in csvImport.ts.
//
// This is deliberately narrow: it only ever returns a category string, never
// touches amounts/dates/math (that all stays plain arithmetic — no reason to
// spend a model call on something a formula already gets right every time),
// and it fails soft — any error (no network, function not deployed, no
// OpenAI key configured yet) just means the caller keeps its existing
// keyword-based guess instead of blocking the import.

import { supabase } from './supabase';

export interface CategorizeItem {
  id: string;
  description: string;
  type: 'income' | 'expense';
}

export interface CategorizeOutcome {
  results: Map<string, string>;
  // False if EVERY batch failed (network/CORS error, function not deployed,
  // OpenAI key missing, etc). The caller uses this to tell the user "AI
  // check didn't run" instead of falsely claiming success just because the
  // call was attempted — a silent failure here previously looked identical
  // to a successful-but-unchanged result in the UI.
  ok: boolean;
  // First error message seen, logged to the console for debugging (e.g. a
  // CORS failure, a missing OPENAI_API_KEY, an OpenAI error) — never shown
  // to the user as a raw error, just useful when checking devtools.
  firstError?: string;
}

const BATCH_SIZE = 40;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function categorizeWithAI(items: CategorizeItem[]): Promise<CategorizeOutcome> {
  const results = new Map<string, string>();
  const batches = chunk(items, BATCH_SIZE);
  let succeededBatches = 0;
  let firstError: string | undefined;

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const { data, error } = await supabase.functions.invoke('categorize-transactions', {
          body: { items: batch },
        });
        if (error) {
          if (!firstError) firstError = error.message || String(error);
          console.warn('[categorizeWithAI] edge function error:', error);
          return;
        }
        if (!data?.results) {
          if (!firstError) firstError = 'No results in response';
          console.warn('[categorizeWithAI] unexpected response shape:', data);
          return;
        }
        succeededBatches++;
        for (const r of data.results as { id: string; category: string }[]) {
          results.set(r.id, r.category);
        }
      } catch (e) {
        if (!firstError) firstError = e instanceof Error ? e.message : String(e);
        console.warn('[categorizeWithAI] threw:', e);
      }
    })
  );

  return { results, ok: succeededBatches > 0, firstError };
}
