// Football API integration using football-data.org (v4)
// Free tier: 10 requests/minute, no daily cap, current season data!
// Proxied through /api/football to avoid CORS issues

import { supabase } from './supabase';

const STORAGE_PREFIX = 'football_';

// Competition codes in football-data.org
export const LEAGUES = {
  PREMIER_LEAGUE: { id: 2021, code: 'PL', name: 'Premier League', country: 'England' },
  CHAMPIONSHIP: { id: 2016, code: 'ELC', name: 'Championship', country: 'England' },
  CHAMPIONS_LEAGUE: { id: 2001, code: 'CL', name: 'Champions League', country: 'Europe' },
  BUNDESLIGA: { id: 2002, code: 'BL1', name: 'Bundesliga', country: 'Germany' },
  LA_LIGA: { id: 2014, code: 'PD', name: 'La Liga', country: 'Spain' },
  SERIE_A: { id: 2019, code: 'SA', name: 'Serie A', country: 'Italy' },
  LIGUE_1: { id: 2015, code: 'FL1', name: 'Ligue 1', country: 'France' },
  EREDIVISIE: { id: 2003, code: 'DED', name: 'Eredivisie', country: 'Netherlands' },
  PRIMEIRA_LIGA: { id: 2017, code: 'PPL', name: 'Primeira Liga', country: 'Portugal' },
} as const;

export type LeagueKey = keyof typeof LEAGUES;

// ─── Types (normalized to match UI expectations) ──────────────────────

export interface FootballTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  logo: string; // alias for crest, for backward compat
  code: string;
  country: string;
}

export interface FootballFixture {
  id: number;
  date: string;
  timestamp: number;
  venue: string | null;
  status: {
    short: string;
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

export interface FavoriteTeamConfig {
  team: FootballTeam;
  leagueId: number;
  leagueCode: string;
  leagueName: string;
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
  clearCache();
  syncSettingsToSupabase();
  window.dispatchEvent(new Event('favoriteTeamUpdated'));
}

export function clearFavoriteTeam(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${STORAGE_PREFIX}favorite_team`);
  clearCache();
  syncSettingsToSupabase();
  window.dispatchEvent(new Event('favoriteTeamUpdated'));
}

// ─── Supabase Sync ────────────────────────────────────────────────────

async function syncSettingsToSupabase(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const settings: Record<string, unknown> = {};
    const team = localStorage.getItem(`${STORAGE_PREFIX}favorite_team`);
    if (team) {
      try { settings.football_team = JSON.parse(team); } catch { /* ignore */ }
    }

    await supabase
      .from('profiles')
      .update({ settings })
      .eq('user_id', user.id);
  } catch (err) {
    console.error('Failed to sync football settings:', err);
  }
}

export async function loadSettingsFromSupabase(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('settings')
      .eq('user_id', user.id)
      .single();

    if (!data?.settings) return;

    const settings = data.settings as Record<string, unknown>;

    if (settings.football_team && !localStorage.getItem(`${STORAGE_PREFIX}favorite_team`)) {
      localStorage.setItem(`${STORAGE_PREFIX}favorite_team`, JSON.stringify(settings.football_team));
      window.dispatchEvent(new Event('favoriteTeamUpdated'));
    }
  } catch (err) {
    console.error('Failed to load football settings:', err);
  }
}

// ─── Cache Management ─────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
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
    // localStorage full
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
  // Use our Next.js proxy to avoid CORS issues (API key is server-side in .env)
  const url = new URL('/api/football', window.location.origin);
  url.searchParams.set('endpoint', endpoint);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
    });

    if (res.status === 429) {
      console.warn('football-data.org: rate limit hit, try again in a minute');
      return null;
    }

    if (!res.ok) {
      console.error('football-data.org error:', res.status, res.statusText);
      return null;
    }

    return await res.json() as T;
  } catch (err) {
    console.error('football-data.org fetch error:', err);
    return null;
  }
}

// ─── Normalize API responses ──────────────────────────────────────────

interface FDTeamRaw {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  area?: { name: string };
}

interface FDMatchRaw {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | null;
  matchday: number | null;
  stage: string | null;
  group: string | null;
  homeTeam: { id: number; name: string; shortName: string; tla: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; tla: string; crest: string };
  score: {
    winner: string | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  competition: {
    id: number;
    name: string;
    emblem: string;
    code: string;
  };
  venue?: string;
}

interface FDStandingRaw {
  position: number;
  team: { id: number; name: string; shortName: string; tla: string; crest: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string | null;
}

function normalizeTeam(raw: FDTeamRaw): FootballTeam {
  return {
    id: raw.id,
    name: raw.shortName || raw.name,
    shortName: raw.shortName || raw.name,
    tla: raw.tla || '',
    crest: raw.crest || '',
    logo: raw.crest || '',
    code: raw.tla || '',
    country: raw.area?.name || '',
  };
}

function mapStatus(status: string, minute?: number | null): { short: string; long: string; elapsed: number | null } {
  const statusMap: Record<string, string> = {
    SCHEDULED: 'NS',
    TIMED: 'NS',
    IN_PLAY: '2H',
    PAUSED: 'HT',
    FINISHED: 'FT',
    SUSPENDED: 'SUSP',
    POSTPONED: 'PST',
    CANCELLED: 'CANC',
    AWARDED: 'AWD',
    EXTRA_TIME: 'ET',
    PENALTY_SHOOTOUT: 'PEN',
  };

  return {
    short: statusMap[status] || status,
    long: status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
    elapsed: minute ?? null,
  };
}

function normalizeMatch(raw: FDMatchRaw): FootballFixture {
  const homeWinner = raw.score.winner === 'HOME_TEAM' ? true : raw.score.winner === 'AWAY_TEAM' ? false : raw.score.winner === 'DRAW' ? null : null;
  const awayWinner = raw.score.winner === 'AWAY_TEAM' ? true : raw.score.winner === 'HOME_TEAM' ? false : raw.score.winner === 'DRAW' ? null : null;

  const round = raw.stage
    ? raw.matchday
      ? `Matchday ${raw.matchday}`
      : raw.stage.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    : raw.matchday
      ? `Matchday ${raw.matchday}`
      : '';

  return {
    id: raw.id,
    date: raw.utcDate,
    timestamp: new Date(raw.utcDate).getTime() / 1000,
    venue: raw.venue || null,
    status: mapStatus(raw.status, raw.minute),
    league: {
      id: raw.competition.id,
      name: raw.competition.name,
      logo: raw.competition.emblem || '',
      round,
    },
    teams: {
      home: {
        id: raw.homeTeam.id,
        name: raw.homeTeam.shortName || raw.homeTeam.name,
        logo: raw.homeTeam.crest || '',
        winner: homeWinner,
      },
      away: {
        id: raw.awayTeam.id,
        name: raw.awayTeam.shortName || raw.awayTeam.name,
        logo: raw.awayTeam.crest || '',
        winner: awayWinner,
      },
    },
    goals: {
      home: raw.score.fullTime.home,
      away: raw.score.fullTime.away,
    },
    score: {
      halftime: { home: raw.score.halfTime.home, away: raw.score.halfTime.away },
      fulltime: { home: raw.score.fullTime.home, away: raw.score.fullTime.away },
    },
  };
}

function normalizeStanding(raw: FDStandingRaw): StandingEntry {
  return {
    rank: raw.position,
    team: {
      id: raw.team.id,
      name: raw.team.shortName || raw.team.name,
      logo: raw.team.crest || '',
    },
    points: raw.points,
    goalsDiff: raw.goalDifference,
    form: raw.form,
    all: {
      played: raw.playedGames,
      win: raw.won,
      draw: raw.draw,
      lose: raw.lost,
      goals: { for: raw.goalsFor, against: raw.goalsAgainst },
    },
  };
}

// ─── Get Teams in a League ────────────────────────────────────────────

export async function getTeamsInLeague(leagueCode: string): Promise<FootballTeam[]> {
  const cacheKey = `league_teams_${leagueCode}`;
  const cached = getCache<FootballTeam[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<{ teams: FDTeamRaw[] }>(`/competitions/${leagueCode}/teams`);
  if (!data?.teams) return [];

  const teams = data.teams.map(normalizeTeam).sort((a, b) => a.name.localeCompare(b.name));
  setCache(cacheKey, teams, 60 * 24 * 7); // 7 days
  return teams;
}

// ─── Search Teams ─────────────────────────────────────────────────────

export async function searchTeams(query: string): Promise<FootballTeam[]> {
  if (query.length < 3) return [];

  const cacheKey = `search_${query.toLowerCase()}`;
  const cached = getCache<FootballTeam[]>(cacheKey);
  if (cached) return cached;

  // football-data.org has no search endpoint, so search across cached league teams
  const allTeams: FootballTeam[] = [];
  const leagueCodes = Object.values(LEAGUES).map(l => l.code);

  for (const code of leagueCodes.slice(0, 3)) {
    const teams = await getTeamsInLeague(code);
    allTeams.push(...teams);
  }

  const lowerQuery = query.toLowerCase();
  const results = allTeams.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.shortName?.toLowerCase().includes(lowerQuery) ||
    t.tla?.toLowerCase().includes(lowerQuery)
  );

  const unique = Array.from(new Map(results.map(t => [t.id, t])).values());
  setCache(cacheKey, unique, 60 * 24);
  return unique;
}

// ─── Get Next Fixture for Team ────────────────────────────────────────

export async function getNextFixture(teamId: number): Promise<FootballFixture | null> {
  const cacheKey = `next_fixture_${teamId}`;
  const cached = getCache<FootballFixture>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<{ matches: FDMatchRaw[] }>(`/teams/${teamId}/matches`, {
    status: 'SCHEDULED',
    limit: 1,
  });

  if (!data?.matches || data.matches.length === 0) return null;

  const fixture = normalizeMatch(data.matches[0]);
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

  const data = await apiFetch<{ matches: FDMatchRaw[] }>(`/teams/${teamId}/matches`, {
    status: 'FINISHED',
    limit: 5,
  });

  if (!data?.matches || data.matches.length === 0) return null;

  const lastRaw = data.matches[data.matches.length - 1];
  const fixture = normalizeMatch(lastRaw);
  setCache(cacheKey, fixture, 60 * 4); // 4h
  return fixture;
}

// ─── Get Recent and Upcoming Fixtures ─────────────────────────────────

export async function getRecentFixtures(teamId: number, count: number = 10): Promise<FootballFixture[]> {
  const cacheKey = `recent_fixtures_${teamId}_${count}`;
  const cached = getCache<FootballFixture[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<{ matches: FDMatchRaw[] }>(`/teams/${teamId}/matches`, {
    status: 'FINISHED',
    limit: count,
  });

  if (!data?.matches) return [];
  const fixtures = data.matches.map(normalizeMatch);
  setCache(cacheKey, fixtures, 60 * 2);
  return fixtures;
}

export async function getUpcomingFixtures(teamId: number, count: number = 10): Promise<FootballFixture[]> {
  const cacheKey = `upcoming_fixtures_${teamId}_${count}`;
  const cached = getCache<FootballFixture[]>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<{ matches: FDMatchRaw[] }>(`/teams/${teamId}/matches`, {
    status: 'SCHEDULED',
    limit: count,
  });

  if (!data?.matches) return [];
  const fixtures = data.matches.map(normalizeMatch);
  setCache(cacheKey, fixtures, 60 * 2);
  return fixtures;
}

// ─── Get All Season Fixtures (played + scheduled) ────────────────────

export async function getAllSeasonFixtures(teamId: number): Promise<FootballFixture[]> {
  const cacheKey = `all_season_fixtures_${teamId}`;
  const cached = getCache<FootballFixture[]>(cacheKey);
  if (cached) return cached;

  // Fetch finished and scheduled matches in parallel
  const [finishedData, scheduledData] = await Promise.all([
    apiFetch<{ matches: FDMatchRaw[] }>(`/teams/${teamId}/matches`, {
      status: 'FINISHED',
      limit: 100,
    }),
    apiFetch<{ matches: FDMatchRaw[] }>(`/teams/${teamId}/matches`, {
      status: 'SCHEDULED,TIMED',
      limit: 100,
    }),
  ]);

  const finished = finishedData?.matches?.map(normalizeMatch) ?? [];
  const scheduled = scheduledData?.matches?.map(normalizeMatch) ?? [];

  // Combine and sort by date ascending
  const all = [...finished, ...scheduled].sort((a, b) => a.timestamp - b.timestamp);

  // Deduplicate by id
  const unique = Array.from(new Map(all.map(f => [f.id, f])).values());

  setCache(cacheKey, unique, 60 * 2); // 2h cache
  return unique;
}

// ─── Get Live Fixture ─────────────────────────────────────────────────

export async function getLiveFixture(teamId: number): Promise<FootballFixture | null> {
  const cacheKey = `live_fixture_${teamId}`;
  const cached = getCache<FootballFixture>(cacheKey);
  if (cached) return cached;

  const data = await apiFetch<{ matches: FDMatchRaw[] }>(`/teams/${teamId}/matches`, {
    status: 'IN_PLAY,PAUSED',
    limit: 1,
  });

  if (!data?.matches || data.matches.length === 0) return null;

  const fixture = normalizeMatch(data.matches[0]);
  setCache(cacheKey, fixture, 1); // 1 min cache
  return fixture;
}

// ─── Get Standings ────────────────────────────────────────────────────

export async function getStandings(competitionCode: string): Promise<StandingEntry[]> {
  const cacheKey = `standings_${competitionCode}`;
  const cached = getCache<StandingEntry[]>(cacheKey);
  if (cached) return cached;

  console.log('[Football] Fetching standings for:', competitionCode);
  const data = await apiFetch<{
    standings: Array<{
      stage: string;
      type: string;
      group: string | null;
      table: FDStandingRaw[];
    }>;
  }>(`/competitions/${competitionCode}/standings`);

  console.log('[Football] Standings API response:', data ? `${data.standings?.length ?? 0} standing groups` : 'null');
  if (data?.standings) {
    data.standings.forEach((s, i) => console.log(`[Football]   [${i}] type=${s.type} stage=${s.stage} rows=${s.table?.length ?? 0}`));
  }

  if (!data?.standings) return [];

  // Try TOTAL first (domestic leagues), then fall back to other types (CL league phase etc.)
  const totalStandings = data.standings.find(s => s.type === 'TOTAL')
    || data.standings.find(s => s.type === 'LEAGUE_PHASE')
    || data.standings[0]; // fallback to first available
  if (!totalStandings) return [];

  console.log('[Football] Using standings type:', totalStandings.type, 'with', totalStandings.table.length, 'rows');
  const standings = totalStandings.table.map(normalizeStanding);
  setCache(cacheKey, standings, 60); // 1h
  return standings;
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

// ─── Helper: Get match result ─────────────────────────────────────────

export function getMatchResult(fixture: FootballFixture, teamId: number): 'W' | 'D' | 'L' | null {
  if (!['FT', 'AET', 'PEN', 'AWD'].includes(fixture.status.short)) return null;
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
