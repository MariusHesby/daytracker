// Fun Facts API integration
// Uses multiple free APIs for interesting "did you know" facts

export type FunFactCategory =
  | "random"
  | "animals"
  | "cats"
  | "dogs";

export interface FunFact {
  fact: string;
  category: FunFactCategory;
  source?: string;
}

// Storage key for selected categories
export const FUN_FACT_CATEGORIES_KEY = "funFactCategories";

// Default categories
export const DEFAULT_CATEGORIES: FunFactCategory[] = ["random"];

// Category display names
export const CATEGORY_LABELS: Record<FunFactCategory, string> = {
  random: "Random Facts",
  animals: "Animal Facts",
  cats: "Cat Facts",
  dogs: "Dog Facts",
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

// Fetch fact by specific category (exported for testing in settings)
export async function fetchFactByCategory(category: FunFactCategory): Promise<FunFact> {
  switch (category) {
    case "cats":
      return fetchCatFact();
    case "dogs":
      return fetchDogFact();
    case "animals":
      // Randomly pick between cat and dog facts for animals
      return Math.random() > 0.5 ? fetchCatFact() : fetchDogFact();
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

// Cat Facts API
async function fetchCatFact(): Promise<FunFact> {
  const response = await fetch("https://catfact.ninja/fact");
  if (!response.ok) throw new Error("Cat Facts API error");
  
  const data = await response.json();
  return {
    fact: data.fact,
    category: "cats",
    source: "Cat Facts",
  };
}

// Dog Facts API  
async function fetchDogFact(): Promise<FunFact> {
  const response = await fetch("https://dogapi.dog/api/v2/facts?limit=1");
  if (!response.ok) throw new Error("Dog Facts API error");

  const data = await response.json();
  return {
    fact: data.data[0]?.attributes?.body || "Dogs are amazing companions!",
    category: "dogs",
    source: "Dog Facts",
  };
}
