// TMDb API wrapper for movie/TV show data
// Get a free API key at: https://www.themoviedb.org/settings/api

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export interface TMDbSearchResult {
  id: number;
  title?: string; // For movies
  name?: string; // For TV series
  release_date?: string; // For movies
  first_air_date?: string; // For TV series
  poster_path: string | null;
  media_type?: 'movie' | 'tv';
  vote_average: number;
}

export interface TMDbMediaResult {
  imdbID: string;
  Title: string;
  Year: string;
  Type: 'movie' | 'series';
  Poster: string;
  Rating: string;
}

// Search for movies/TV shows by title
export async function searchTMDb(
  query: string,
  type?: 'movie' | 'series'
): Promise<TMDbMediaResult[]> {
  if (!TMDB_API_KEY) {
    console.warn('TMDb API key not configured');
    return [];
  }

  if (!query.trim()) return [];

  try {
    // Map our type to TMDb's type
    const tmdbType = type === 'series' ? 'tv' : type;
    
    // Use multi-search if no type specified, otherwise use specific search
    const endpoint = tmdbType 
      ? `${TMDB_BASE_URL}/search/${tmdbType}`
      : `${TMDB_BASE_URL}/search/multi`;
    
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      query: query.trim(),
      include_adult: 'false',
    });

    const response = await fetch(`${endpoint}?${params}`);
    const data = await response.json();

    if (!data.results) return [];

    // Transform results to match our expected format
    return data.results
      .filter((item: TMDbSearchResult) => {
        // Filter out people and other non-media results
        if (!tmdbType && item.media_type !== 'movie' && item.media_type !== 'tv') {
          return false;
        }
        return true;
      })
      .slice(0, 10)
      .map((item: TMDbSearchResult) => {
        const isMovie = item.media_type === 'movie' || item.title !== undefined;
        const title = isMovie ? item.title : item.name;
        const date = isMovie ? item.release_date : item.first_air_date;
        const year = date ? date.substring(0, 4) : 'N/A';
        
        return {
          imdbID: `tmdb-${item.id}`, // We'll use TMDb ID prefixed
          Title: title || 'Unknown',
          Year: year,
          Type: isMovie ? 'movie' : 'series',
          Poster: item.poster_path 
            ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}`
            : 'N/A',
          Rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        } as TMDbMediaResult;
      });
  } catch (error) {
    console.error('TMDb search error:', error);
    return [];
  }
}

// Get detailed info by TMDb ID
export async function getTMDbDetails(
  tmdbId: number,
  type: 'movie' | 'tv'
): Promise<TMDbMediaResult | null> {
  if (!TMDB_API_KEY) {
    console.warn('TMDb API key not configured');
    return null;
  }

  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
    });

    const response = await fetch(`${TMDB_BASE_URL}/${type}/${tmdbId}?${params}`);
    const data = await response.json();

    if (!data.id) return null;

    const isMovie = type === 'movie';
    const title = isMovie ? data.title : data.name;
    const date = isMovie ? data.release_date : data.first_air_date;
    const year = date ? date.substring(0, 4) : 'N/A';

    return {
      imdbID: `tmdb-${data.id}`,
      Title: title || 'Unknown',
      Year: year,
      Type: isMovie ? 'movie' : 'series',
      Poster: data.poster_path 
        ? `${TMDB_IMAGE_BASE}/w500${data.poster_path}`
        : 'N/A',
      Rating: data.vote_average ? data.vote_average.toFixed(1) : 'N/A',
    };
  } catch (error) {
    console.error('TMDb details error:', error);
    return null;
  }
}

// Check if API key is configured
export function isTMDbConfigured(): boolean {
  return !!TMDB_API_KEY;
}

// Helper to get a valid poster URL or placeholder
export function getTMDbPosterUrl(posterPath: string | null): string {
  if (posterPath && posterPath !== 'N/A') {
    // If it's already a full URL, return as-is
    if (posterPath.startsWith('http')) {
      return posterPath;
    }
    return `${TMDB_IMAGE_BASE}/w500${posterPath}`;
  }
  // Return a placeholder for missing posters
  return 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="150" viewBox="0 0 100 150">
      <rect fill="#374151" width="100" height="150"/>
      <text fill="#9CA3AF" font-family="system-ui" font-size="12" text-anchor="middle" x="50" y="75">No Poster</text>
    </svg>
  `);
}
