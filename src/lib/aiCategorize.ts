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

const BATCH_SIZE = 40;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Returns a Map of id -> category for every item the AI could confidently
// place in that item's own allowed category list. Missing ids (network
// failure on that batch, function not configured, etc.) simply aren't in
// the map — the caller keeps whatever guess it already had for those.
export async function categorizeWithAI(items: CategorizeItem[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const batches = chunk(items, BATCH_SIZE);
  await Promise.all(
    batches.map(async (batch) => {
      try {
        const { data, error } = await supabase.functions.invoke('categorize-transactions', {
          body: { items: batch },
        });
        if (error || !data?.results) return;
        for (const r of data.results as { id: string; category: string }[]) {
          results.set(r.id, r.category);
        }
      } catch {
        // Network hiccup or function unavailable — this batch's rows just
        // keep their keyword-guessed category.
      }
    })
  );
  return results;
}
