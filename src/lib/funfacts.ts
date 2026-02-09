// Fun Facts API integration
// Uses multiple free APIs for different categories

export type FunFactCategory =
  | "random"
  | "animals"
  | "science"
  | "history"
  | "trivia"
  | "cats"
  | "dogs"
  | "sports"
  | "movies"
  | "celebrities";

export interface FunFact {
  fact: string;
  category: FunFactCategory;
  source?: string;
  answer?: string; // For trivia questions, the answer is separate
  choices?: string[]; // Multiple choice options (shuffled)
}

// Storage key for selected categories
export const FUN_FACT_CATEGORIES_KEY = "funFactCategories";

// Default categories
export const DEFAULT_CATEGORIES: FunFactCategory[] = ["random"];

// Category display names
export const CATEGORY_LABELS: Record<FunFactCategory, string> = {
  random: "Random Facts",
  animals: "Animal Facts",
  science: "Science & Nature",
  history: "History",
  trivia: "Trivia",
  cats: "Cat Facts",
  dogs: "Dog Facts",
  sports: "Sports",
  movies: "Movies & TV",
  celebrities: "Celebrities",
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
      fact: "Did you know? You just completed tracking your day! 🎉",
      category: "random",
      source: "DayTracker",
    };
  }
}

// Fetch fact by specific category
async function fetchFactByCategory(category: FunFactCategory): Promise<FunFact> {
  switch (category) {
    case "cats":
      return fetchCatFact();
    case "dogs":
      return fetchDogFact();
    case "trivia":
    case "science":
    case "history":
    case "sports":
    case "movies":
    case "celebrities":
      return fetchTriviaFact(category);
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

// Open Trivia Database - for trivia, science, history, sports, movies, celebrities
async function fetchTriviaFact(category: FunFactCategory): Promise<FunFact> {
  // Map our categories to Open Trivia DB category IDs
  const categoryMap: Record<string, number> = {
    science: 17, // Science & Nature
    history: 23, // History
    trivia: 9, // General Knowledge
    sports: 21, // Sports
    movies: 11, // Film (Entertainment: Film)
    celebrities: 26, // Celebrities
  };

  const categoryId = categoryMap[category] || 9;
  const response = await fetch(
    `https://opentdb.com/api.php?amount=1&category=${categoryId}&type=multiple`,
  );

  if (!response.ok) throw new Error("Trivia API error");

  const data = await response.json();
  if (data.results && data.results.length > 0) {
    const result = data.results[0];
    // Decode HTML entities
    const question = decodeHTMLEntities(result.question);
    const answer = decodeHTMLEntities(result.correct_answer);
    const incorrectAnswers = (result.incorrect_answers || []).map(decodeHTMLEntities);
    // Shuffle all choices together
    const allChoices = [answer, ...incorrectAnswers];
    const shuffledChoices = allChoices.sort(() => Math.random() - 0.5);
    return {
      fact: question,
      answer: answer,
      choices: shuffledChoices,
      category: category,
      source: "Open Trivia DB",
    };
  }

  throw new Error("No trivia results");
}

// Helper to decode HTML entities from trivia API
function decodeHTMLEntities(text: string): string {
  const textarea = typeof document !== "undefined" 
    ? document.createElement("textarea")
    : null;
  if (textarea) {
    textarea.innerHTML = text;
    return textarea.value;
  }
  // Fallback for server-side
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
