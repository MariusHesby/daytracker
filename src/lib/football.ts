// Football API integration using API-Football (api-sports.io)
// Free tier: 100 requests/day — we cache aggressively

const API_BASE = 'https://v3.football.api-sports.io';
const STORAGE_PREFIX = 'football_';

// League IDs in API-Football
export const LEAGUES = {
  PREMIER_LEAGUE: { id: 39, name: 'Premier League', country: 'England' },
  CHAMPIONSHIP: { id: 40, name: 'Championship', country: 'England' },
  LEAGUE_ONE: { id: 41, name: 'League One', country: 'England' },
  LEAGUE_TWO: { id: 42, name: 'League Two', country: 'England' },
  CHAMPIONS_LEAGUE: { id: 2, name: 'Champions League', country: 'Europe' },
} as const;

export type LeagueKey = keyof typeof LEAGUES;

// Types
export interface FootballTeam {
  id: number;
  name: string;
  code: string;
  country: string;
  logo: string;
}

export interface FootballFixture {
  id: number;
  date: string;
  timestamp: number;
  venue: { name: string; city: string } | null;
  status: {
    short: string; // NS, 1H, HT, 2H, FT, etc.
    long: string;
    elapsed: number | null;
  };
  league: {
    id: number;
    name: string;
    logo: string;
    round: string;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}

export interface StandingEntry {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  form: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
}

export interface FixtureStatistic {
  type: string;
  value: number | string | null;
}

export interface FixtureStats {
  team: { id: number; name: string; logo: string };
  statistics: FixtureStatistic[];
}

export interface FavoriteTeamConfig {
  team: FootballTeam;
  leagueId: number;
  leagueName: string;
}

// ─── API Key Management ───────────────────────────────────────────────

export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`${STORAGE_PREFIX}api_key`);
}

export function setApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${STORAGE_PREFIX}api_key`, key);
}

// ─── Favorite Team Management ─────────────────────────────────────────

export function getFavoriteTeam(): FavoriteTeamConfig | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(`${STORAGE_PREFIX}favorite_team`);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setFavoriteTeam(config: FavoriteTeamConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${STORAGE_PREFIX}favorite_team`, JSON.stringify(config));
  // Clear cached data when team changes
  clearCache();
  window.dispatchEvent(new Event('favoriteTeamUpdated'));
}

export function clearFavoriteTeam(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${STORAGE_PREFIX}favorite_team`);
  clearCache();
  window.dispatchEvent(new Event('favoriteTeamUpdated'));
}

// ─── Cache Management ─────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in ms
}

function getCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(`${STORAGE_PREFIX}cache_${key}`);
  if (!stored) return null;
  try {
    const entry: CacheEntry<T> = JSON.parse(stored);
    if (Date.now() - entry.timestamp > entry.ttl) {
      localStorage.removeItem(`${STORAGE_PREFIX}cache_${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T, ttlMinutes: number): void {
  if (typeof window === 'undefined') return;
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl: ttlMinutes * 60 * 1000,
  };
  try {
    localStorage.setItem(`${STORAGE_PREFIX}cache_${key}`, JSON.stringify(entry));
  } catch {
    // localStorage full, ignore
  }
}

function clearCache(): void {
  if (typeof window === 'undefined') return;
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(`${STORAGE_PREFIX}cache_`)) {
      localStorage.removeItem(key);
    }
  });
}

// ─── API Fetcher ──────────────────────────────────────────────────────

async function apiFetch<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
      },
    });

    if (!res.ok) return null;

    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
      console.error('API-Football errors:', json.errors);
      return null;
    }

    return json.response as T;
  } catch (err) {
    console.error('API-Football fetch error:', err);
    return null;
  }
}

// ─── Get current season year ──────────────────────────────────────────

function getCurrentSeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  // Football seasons typically start in August
  // If we're before August, the season started last year
  return month >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

// ─── Search Teams ─────────────────────────────────────────────────────

export async function searchTeams(query: string): Promise<FootballTeam[]> {
  if (query.length < 3) return [];

  const cacheKey = `search_${query.toLowerCase()}`;
  const cached = getCache<FootballTeam[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<Array<{ team: FootballTeam; venue: unknown }>>('/teams', { search: query });
  if (!data) return [];

  const teams = data.map(item => item.team);
  setCache(cacheKey, teams, 60 * 24); // Cache for 24h
  return teams;
}

// ─── Get Teams in a League ────────────────────────────────────────────

export async function getTeamsInLeague(leagueId: number): Promise<FootballTeam[]> {
  const season = getCurrentSeason();
  const cacheKey = `league_teams_${leagueId}_${season}`;
  const cached = getCache<FootballTeam[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<Array<{ team: FootballTeam; venue: unknown }>>('/teams', {
    league: leagueId,
    season,
  });
  if (!data) return [];

  const teams = data.map(item => item.team);
  setCache(cacheKey, teams, 60 * 24 * 7); // Cache for 7 days
  return teams;
}

// ─── Get Next Fixture for Team ────────────────────────────────────────

export async function getNextFixture(teamId: number): Promise<FootballFixture | null> {
  const cacheKey = `next_fixture_${teamId}`;
  const cached = getCache<FootballFixture>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<FootballFixture[]>('/fixtures', {
    team: teamId,
    next: 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
  });

  if (!data || data.length === 0) return null;

  const fixture = data[0];
  // Cache until the match starts (min 30 min, max 24h)
  const msUntilMatch = fixture.timestamp * 1000 - Date.now();
  const ttlMin = Math.max(30, Math.min(60 * 24, msUntilMatch / 60000));
  setCache(cacheKey, fixture, ttlMin);
  return fixture;
}

// ─── Get Last Fixture for Team ────────────────────────────────────────

export async function getLastFixture(teamId: number): Promise<FootballFixture | null> {
  const cacheKey = `last_fixture_${teamId}`;
  const cached = getCache<FootballFixture>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<FootballFixture[]>('/fixtures', {
    team: teamId,
    last: 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
  });

  if (!data || data.length === 0) return null;

  const fixture = data[0];
  setCache(cacheKey, fixture, 60 * 4); // Cache for 4 hours
  return fixture;
}

// ─── Get Recent and Upcoming Fixtures ─────────────────────────────────

export async function getRecentFixtures(teamId: number, count: number = 5): Promise<FootballFixture[]> {
  const cacheKey = `recent_fixtures_${teamId}_${count}`;
  const cached = getCache<FootballFixture[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<FootballFixture[]>('/fixtures', {
    team: teamId,
    last: count,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
  });

  if (!data) return [];
  setCache(cacheKey, data, 60 * 2); // Cache for 2 hours
  return data;
}

export async function getUpcomingFixtures(teamId: number, count: number = 5): Promise<FootballFixture[]> {
  const cacheKey = `upcoming_fixtures_${teamId}_${count}`;
  const cached = getCache<FootballFixture[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<FootballFixture[]>('/fixtures', {
    team: teamId,
    next: count,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
  });

  if (!data) return [];
  setCache(cacheKey, data, 60 * 2); // Cache for 2 hours
  return data;
}

// ─── Get Live Fixture ─────────────────────────────────────────────────

export async function getLiveFixture(teamId: number): Promise<FootballFixture | null> {
  // Don't cache live data
  const data = await apiFetch<FootballFixture[]>('/fixtures', {
    team: teamId,
    live: 'all',
  });

  if (!data || data.length === 0) return null;
  return data[0];
}

// ─── Get Standings ────────────────────────────────────────────────────

export async function getStandings(leagueId: number): Promise<StandingEntry[]> {
  const season = getCurrentSeason();
  const cacheKey = `standings_${leagueId}_${season}`;
  const cached = getCache<StandingEntry[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<Array<{ league: { standings: StandingEntry[][] } }>>('/standings', {
    league: leagueId,
    season,
  });

  if (!data || data.length === 0) return [];

  // standings is an array of arrays (groups). For leagues, take first group.
  const standings = data[0]?.league?.standings?.[0] || [];
  setCache(cacheKey, standings, 60); // Cache for 1 hour
  return standings;
}

// ─── Get Fixture Statistics ───────────────────────────────────────────

export async function getFixtureStats(fixtureId: number): Promise<FixtureStats[]> {
  const cacheKey = `fixture_stats_${fixtureId}`;
  const cached = getCache<FixtureStats[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<FixtureStats[]>('/fixtures/statistics', {
    fixture: fixtureId,
  });

  if (!data) return [];
  setCache(cacheKey, data, 60 * 24); // Cache for 24h (historical data)
  return data;
}

// ─── Helper: Format match date ────────────────────────────────────────

export function formatMatchDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;

  const daysDiff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 0 && daysDiff <= 6) {
    const dayName = date.toLocaleDateString([], { weekday: 'short' });
    return `${dayName} ${time}`;
  }

  return date.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ` ${time}`;
}

// ─── Helper: Get match result for favorite team ───────────────────────

export function getMatchResult(fixture: FootballFixture, teamId: number): 'W' | 'D' | 'L' | null {
  if (fixture.status.short !== 'FT' && fixture.status.short !== 'AET' && fixture.status.short !== 'PEN') {
    return null;
  }
  const isHome = fixture.teams.home.id === teamId;
  const team = isHome ? fixture.teams.home : fixture.teams.away;
  if (team.winner === true) return 'W';
  if (team.winner === false) return 'L';
  return 'D';
}

// ─── Helper: Is match live ────────────────────────────────────────────

export function isMatchLive(fixture: FootballFixture): boolean {
  const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];
  return liveStatuses.includes(fixture.status.short);
}

// ─── Validate API Key ─────────────────────────────────────────────────

export async function validateApiKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/status`, {
      method: 'GET',
      headers: { 'x-apisports-key': key },
    });
    if (!res.ok) return false;
    const json = await res.json();
    return json.response?.account?.email != null;
  } catch {
    return false;
  }
}
