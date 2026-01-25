// wger.de API integration for exercise data
// Free, open-source fitness API with 800+ exercises

const WGER_BASE_URL = "https://wger.de/api/v2";

export interface WgerMuscle {
  id: number;
  name: string;
  name_en: string;
  is_front: boolean;
  image_url_main: string;
  image_url_secondary: string;
}

export interface WgerEquipment {
  id: number;
  name: string;
}

export interface WgerExerciseImage {
  id: number;
  image: string;
  is_main: boolean;
}

export interface WgerExerciseTranslation {
  id: number;
  name: string;
  description: string;
  language: number;
}

export interface WgerExercise {
  id: number;
  uuid: string;
  category: {
    id: number;
    name: string;
  };
  muscles: WgerMuscle[];
  muscles_secondary: WgerMuscle[];
  equipment: WgerEquipment[];
  images: WgerExerciseImage[];
  translations: WgerExerciseTranslation[];
  videos: { url: string }[];
}

export interface WgerCategory {
  id: number;
  name: string;
}

// Map wger categories to our simplified categories
export const WGER_CATEGORY_MAP: Record<number, string> = {
  10: "abs",
  8: "arms",
  12: "back",
  14: "calves",
  15: "cardio",
  11: "chest",
  9: "legs",
  13: "shoulders",
};

export const CATEGORY_ICONS: Record<string, string> = {
  abs: "🎯",
  arms: "💪",
  back: "🔙",
  calves: "🦵",
  cardio: "❤️",
  chest: "🫁",
  legs: "🦿",
  shoulders: "🏋️",
};

export const CATEGORY_COLORS: Record<string, string> = {
  abs: "from-orange-400 to-orange-600",
  arms: "from-blue-400 to-blue-600",
  back: "from-green-400 to-green-600",
  calves: "from-purple-400 to-purple-600",
  cardio: "from-red-400 to-red-600",
  chest: "from-cyan-400 to-cyan-600",
  legs: "from-pink-400 to-pink-600",
  shoulders: "from-yellow-400 to-yellow-600",
};

// Cache for API responses
const exerciseCache = new Map<string, { data: WgerExercise[]; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Get English translation for an exercise
export function getExerciseName(exercise: WgerExercise): string {
  // Language 2 is English
  const englishTranslation = exercise.translations.find((t) => t.language === 2);
  return englishTranslation?.name || exercise.translations[0]?.name || "Unknown Exercise";
}

export function getExerciseDescription(exercise: WgerExercise): string {
  const englishTranslation = exercise.translations.find((t) => t.language === 2);
  // Strip HTML tags
  const desc = englishTranslation?.description || exercise.translations[0]?.description || "";
  return desc.replace(/<[^>]*>/g, "").trim();
}

export function getExerciseImage(exercise: WgerExercise): string | null {
  if (exercise.images.length === 0) return null;
  const mainImage = exercise.images.find((img) => img.is_main);
  return mainImage?.image || exercise.images[0]?.image || null;
}

export function getExerciseMuscles(exercise: WgerExercise): string[] {
  return exercise.muscles.map((m) => m.name_en || m.name);
}

// Fetch all categories
export async function fetchCategories(): Promise<WgerCategory[]> {
  try {
    const response = await fetch(`${WGER_BASE_URL}/exercisecategory/`);
    if (!response.ok) throw new Error("Failed to fetch categories");
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

// Fetch exercises by category
export async function fetchExercisesByCategory(
  categoryId: number,
  limit: number = 50
): Promise<WgerExercise[]> {
  const cacheKey = `category-${categoryId}`;
  const cached = exerciseCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `${WGER_BASE_URL}/exerciseinfo/?category=${categoryId}&limit=${limit}&language=2`
    );
    if (!response.ok) throw new Error("Failed to fetch exercises");
    const data = await response.json();
    
    // Filter to only exercises with English translations
    const exercises = (data.results as WgerExercise[]).filter((ex) =>
      ex.translations.some((t) => t.language === 2)
    );
    
    exerciseCache.set(cacheKey, { data: exercises, timestamp: Date.now() });
    return exercises;
  } catch (error) {
    console.error("Error fetching exercises:", error);
    return [];
  }
}

// Search exercises
export async function searchExercises(query: string, limit: number = 20): Promise<WgerExercise[]> {
  if (!query || query.length < 2) return [];

  try {
    const response = await fetch(
      `${WGER_BASE_URL}/exerciseinfo/?language=2&limit=${limit}`
    );
    if (!response.ok) throw new Error("Failed to search exercises");
    const data = await response.json();
    
    // Client-side filtering since wger search is limited
    const exercises = (data.results as WgerExercise[]).filter((ex) => {
      const name = getExerciseName(ex).toLowerCase();
      return name.includes(query.toLowerCase());
    });
    
    return exercises.slice(0, limit);
  } catch (error) {
    console.error("Error searching exercises:", error);
    return [];
  }
}

// Fetch a single exercise by ID
export async function fetchExercise(exerciseId: number): Promise<WgerExercise | null> {
  try {
    const response = await fetch(`${WGER_BASE_URL}/exerciseinfo/${exerciseId}/`);
    if (!response.ok) throw new Error("Failed to fetch exercise");
    return await response.json();
  } catch (error) {
    console.error("Error fetching exercise:", error);
    return null;
  }
}

// Pre-load popular exercises for faster access
export async function preloadPopularExercises(): Promise<WgerExercise[]> {
  const cacheKey = "popular";
  const cached = exerciseCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Fetch a broad set of exercises
    const response = await fetch(`${WGER_BASE_URL}/exerciseinfo/?limit=200&language=2`);
    if (!response.ok) throw new Error("Failed to fetch popular exercises");
    const data = await response.json();
    
    // Filter to exercises with images and English translations
    const exercises = (data.results as WgerExercise[]).filter(
      (ex) => ex.translations.some((t) => t.language === 2)
    );
    
    exerciseCache.set(cacheKey, { data: exercises, timestamp: Date.now() });
    return exercises;
  } catch (error) {
    console.error("Error preloading exercises:", error);
    return [];
  }
}

// Get muscle image URL
export function getMuscleImageUrl(muscle: WgerMuscle, isSecondary: boolean = false): string {
  const baseUrl = "https://wger.de";
  return isSecondary ? `${baseUrl}${muscle.image_url_secondary}` : `${baseUrl}${muscle.image_url_main}`;
}
