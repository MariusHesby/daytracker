// Fun Facts API integration
// Uses multiple free APIs for interesting "did you know" facts

export type FunFactCategory =
  | "random"
  | "wordoftheday_nor"
  | "wordoftheday_eng";

export interface FunFact {
  fact: string;
  category: FunFactCategory;
  source?: string;
  // Word of the day fields
  word?: string;
  wordClass?: string;
  definition?: string;
}

// Storage key for selected categories
export const FUN_FACT_CATEGORIES_KEY = "funFactCategories";

// Default categories
export const DEFAULT_CATEGORIES: FunFactCategory[] = ["random"];

// Category display names
export const CATEGORY_LABELS: Record<FunFactCategory, string> = {
  random: "Random Facts",
  wordoftheday_nor: "Word of the Day (nor)",
  wordoftheday_eng: "Word of the Day (eng)",
};

// Load saved categories from localStorage
export function getSelectedCategories(): FunFactCategory[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;

  const saved = localStorage.getItem(FUN_FACT_CATEGORIES_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as FunFactCategory[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Invalid JSON, use defaults
    }
  }
  return DEFAULT_CATEGORIES;
}

// Save categories to localStorage
export function setSelectedCategories(categories: FunFactCategory[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FUN_FACT_CATEGORIES_KEY, JSON.stringify(categories));
}

// Fetch a random fun fact from the selected categories
export async function fetchRandomFunFact(): Promise<FunFact | null> {
  const categories = getSelectedCategories();

  if (categories.length === 0) {
    return null;
  }

  // Pick a random category from selected ones
  const category = categories[Math.floor(Math.random() * categories.length)];

  try {
    return await fetchFactByCategory(category);
  } catch (error) {
    console.error("Error fetching fun fact:", error);
    // Fallback to a static fact if all APIs fail
    return {
      fact: "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible.",
      category: "random",
      source: "DayTracker",
    };
  }
}

// Fetch fun facts from ALL selected categories
export async function fetchAllFunFacts(): Promise<FunFact[]> {
  const categories = getSelectedCategories();

  if (categories.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    categories.map((category) => fetchFactByCategory(category))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<FunFact> => r.status === "fulfilled")
    .map((r) => r.value);
}

// Fetch fact by specific category (exported for testing in settings)
export async function fetchFactByCategory(category: FunFactCategory): Promise<FunFact> {
  switch (category) {
    case "wordoftheday_nor":
      return fetchNorwegianWordOfTheDay();
    case "wordoftheday_eng":
      return fetchEnglishWordOfTheDay();
    case "random":
    default:
      return fetchUselessFact();
  }
}

// Useless Facts API - Random interesting facts
async function fetchUselessFact(): Promise<FunFact> {
  const response = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");
  if (!response.ok) throw new Error("Useless Facts API error");

  const data = await response.json();
  return {
    fact: data.text,
    category: "random",
    source: "Useless Facts",
  };
}

// Norwegian word of the day (from local curated list)
async function fetchNorwegianWordOfTheDay(): Promise<FunFact> {
  const { getDagensOrd } = await import("@/lib/wordoftheday");
  const dagensOrd = getDagensOrd();
  return {
    fact: dagensOrd.beskrivelse,
    category: "wordoftheday_nor",
    source: "Dagens Ord",
    word: dagensOrd.ord,
    wordClass: dagensOrd.ordklasse,
    definition: dagensOrd.beskrivelse,
  };
}

// English word of the day (from Wordnik API via proxy route)
async function fetchEnglishWordOfTheDay(): Promise<FunFact> {
  const today = new Date().toISOString().split("T")[0];
  const response = await fetch(`/api/wordnik?date=${today}`);
  if (!response.ok) throw new Error("Wordnik API error");

  const data = await response.json();
  return {
    fact: data.definition || "No definition available.",
    category: "wordoftheday_eng",
    source: "Wordnik",
    word: data.word,
    wordClass: data.partOfSpeech,
    definition: data.definition,
  };
}
