// OMDB API wrapper for movie/TV show data
// Get a free API key at: https://www.omdbapi.com/apikey.aspx

const OMDB_API_KEY = process.env.NEXT_PUBLIC_OMDB_API_KEY || '';
const OMDB_BASE_URL = 'https://www.omdbapi.com/';

export interface MediaSearchResult {
  imdbID: string;
  Title: string;
  Year: string;
  Type: 'movie' | 'series' | 'episode';
  Poster: string; // URL or "N/A"
}

export interface MediaDetails {
  imdbID: string;
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: { Source: string; Value: string }[];
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  Type: 'movie' | 'series' | 'episode';
  totalSeasons?: string; // Only for series
  Response: 'True' | 'False';
  Error?: string;
}

export interface SearchResponse {
  Search?: MediaSearchResult[];
  totalResults?: string;
  Response: 'True' | 'False';
  Error?: string;
}

// Search for movies/TV shows by title
export async function searchMedia(
  query: string,
  type?: 'movie' | 'series'
): Promise<MediaSearchResult[]> {
  if (!OMDB_API_KEY) {
    console.warn('OMDB API key not configured');
    return [];
  }

  if (!query.trim()) return [];

  try {
    const params = new URLSearchParams({
      apikey: OMDB_API_KEY,
      s: query.trim(),
      ...(type && { type }),
    });

    const response = await fetch(`${OMDB_BASE_URL}?${params}`);
    const data: SearchResponse = await response.json();

    if (data.Response === 'True' && data.Search) {
      return data.Search;
    }
    return [];
  } catch (error) {
    console.error('OMDB search error:', error);
    return [];
  }
}

// Get detailed info by IMDB ID
export async function getMediaDetails(imdbId: string): Promise<MediaDetails | null> {
  if (!OMDB_API_KEY) {
    console.warn('OMDB API key not configured');
    return null;
  }

  try {
    const params = new URLSearchParams({
      apikey: OMDB_API_KEY,
      i: imdbId,
      plot: 'short',
    });

    const response = await fetch(`${OMDB_BASE_URL}?${params}`);
    const data: MediaDetails = await response.json();

    if (data.Response === 'True') {
      return data;
    }
    return null;
  } catch (error) {
    console.error('OMDB details error:', error);
    return null;
  }
}

// Get details by exact title (useful for looking up already saved entries)
export async function getMediaByTitle(
  title: string,
  type?: 'movie' | 'series',
  year?: string
): Promise<MediaDetails | null> {
  if (!OMDB_API_KEY) {
    console.warn('OMDB API key not configured');
    return null;
  }

  try {
    const params = new URLSearchParams({
      apikey: OMDB_API_KEY,
      t: title,
      plot: 'short',
      ...(type && { type }),
      ...(year && { y: year }),
    });

    const response = await fetch(`${OMDB_BASE_URL}?${params}`);
    const data: MediaDetails = await response.json();

    if (data.Response === 'True') {
      return data;
    }
    return null;
  } catch (error) {
    console.error('OMDB title lookup error:', error);
    return null;
  }
}

// Check if API key is configured
export function isOMDBConfigured(): boolean {
  return !!OMDB_API_KEY;
}

// Helper to get a valid poster URL or placeholder
export function getPosterUrl(poster: string): string {
  if (poster && poster !== 'N/A') {
    return poster;
  }
  // Return a placeholder for missing posters
  return 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="150" viewBox="0 0 100 150">
      <rect fill="#374151" width="100" height="150"/>
      <text fill="#9CA3AF" font-family="system-ui" font-size="12" text-anchor="middle" x="50" y="75">No Poster</text>
    </svg>
  `);
}
