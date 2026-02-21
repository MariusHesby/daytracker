"use client";

import { useEffect, useState, useCallback } from "react";
import { IOSModal } from "@/components/ios";
import {
  getFavoriteTeam,
  loadAllTeamData,
  getStandings,
  getTeamStandingsLeague,
  formatMatchDate,
  getMatchResult,
  isMatchLive,
  FootballFixture,
  StandingEntry,
  FavoriteTeamConfig,
} from "@/lib/football";
import { cn } from "@/lib/utils";

interface FootballPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "match" | "fixtures" | "table";

export function FootballPopup({ isOpen, onClose }: FootballPopupProps) {
  const [tab, setTab] = useState<TabType>("match");
  const [config, setConfig] = useState<FavoriteTeamConfig | null>(null);
  const [nextMatch, setNextMatch] = useState<FootballFixture | null>(null);
  const [lastMatch, setLastMatch] = useState<FootballFixture | null>(null);
  const [liveMatch, setLiveMatch] = useState<FootballFixture | null>(null);
  const [recentFixtures, setRecentFixtures] = useState<FootballFixture[]>([]);
  const [upcomingFixtures, setUpcomingFixtures] = useState<FootballFixture[]>(
    [],
  );
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [standingsLoaded, setStandingsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allFixtures, setAllFixtures] = useState<FootballFixture[]>([]);

  const loadData = useCallback(async () => {
    const fav = getFavoriteTeam();
    if (!fav) return;
    setConfig(fav);
    setIsLoading(true);

    try {
      const data = await loadAllTeamData(fav.team.id);
      setNextMatch(data.nextFixture);
      setLastMatch(data.lastFixture);
      setLiveMatch(data.liveFixture);
      setAllFixtures(data.allFixtures);

      // Derive recent/upcoming from allFixtures
      const now = Date.now() / 1000;
      setRecentFixtures(
        data.allFixtures
          .filter((f) => ["FT", "AET", "PEN", "AWD"].includes(f.status.short))
          .slice(-10),
      );
      setUpcomingFixtures(
        data.allFixtures
          .filter((f) => ["NS", "PST"].includes(f.status.short))
          .slice(0, 10),
      );
    } catch (err) {
      console.error("Error loading football data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStandings = useCallback(async () => {
    const fav = getFavoriteTeam();
    if (!fav) {
      setStandingsLoaded(true);
      return;
    }

    // Dynamically find the team's current league (handles promotions/relegations)
    const leagueCode = await getTeamStandingsLeague(fav.team.id);
    if (!leagueCode) {
      setStandingsLoaded(true);
      return;
    }

    const data = await getStandings(leagueCode);
    setStandings(data);
    setStandingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen, loadData]);

  useEffect(() => {
    if (!isOpen || tab !== "table") return;
    if (!standingsLoaded) {
      loadStandings();
    }
  }, [isOpen, tab, standingsLoaded, loadStandings]);

  // Refresh live match every 60 seconds
  useEffect(() => {
    if (!isOpen || !liveMatch) return;
    const interval = setInterval(async () => {
      const fav = getFavoriteTeam();
      if (!fav) return;
      const data = await loadAllTeamData(fav.team.id);
      setLiveMatch(data.liveFixture);
    }, 60000);
    return () => clearInterval(interval);
  }, [isOpen, liveMatch]);

  const displayMatch = liveMatch || nextMatch;
  const teamId = config?.team.id || 0;

  return (
    <IOSModal
      isOpen={isOpen}
      onClose={onClose}
      title={config?.team.name || "Football"}>
      <div className='pb-4'>
        {/* Tabs */}
        <div className='flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 mb-4'>
          {(["match", "fixtures", "table"] as TabType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-1.5 text-[13px] font-medium rounded-md transition-all",
                tab === t
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400",
              )}>
              {t === "match"
                ? "Match"
                : t === "fixtures"
                  ? "Fixtures"
                  : "Table"}
            </button>
          ))}
        </div>

        {isLoading && tab === "match" ? (
          <div className='flex items-center justify-center py-12'>
            <svg
              className='w-6 h-6 text-gray-400 animate-spin'
              fill='none'
              viewBox='0 0 24 24'>
              <circle
                className='opacity-25'
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='4'
              />
              <path
                className='opacity-75'
                fill='currentColor'
                d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
              />
            </svg>
          </div>
        ) : tab === "match" ? (
          <MatchTab
            displayMatch={displayMatch}
            lastMatch={lastMatch}
            liveMatch={liveMatch}
            teamId={teamId}
          />
        ) : tab === "fixtures" ? (
          <FixturesTab
            recentFixtures={recentFixtures}
            upcomingFixtures={upcomingFixtures}
            teamId={teamId}
            isLoading={
              recentFixtures.length === 0 && upcomingFixtures.length === 0
            }
          />
        ) : (
          <StandingsTab
            standings={standings}
            teamId={teamId}
            leagueName={config?.leagueName || ""}
            isLoading={!standingsLoaded}
          />
        )}
      </div>
    </IOSModal>
  );
}

// ─── Match Tab ────────────────────────────────────────────────────────

function MatchTab({
  displayMatch,
  lastMatch,
  liveMatch,
  teamId,
}: {
  displayMatch: FootballFixture | null;
  lastMatch: FootballFixture | null;
  liveMatch: FootballFixture | null;
  teamId: number;
}) {
  // Show the active/next match display
  const matchToShow = liveMatch || displayMatch;

  if (!matchToShow && !lastMatch) {
    return (
      <div className='text-center py-8'>
        <p className='text-gray-500 dark:text-gray-400 text-[15px]'>
          No upcoming matches found
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Main match display (live or next) */}
      {matchToShow && (
        <div>
          <p className='text-[13px] text-gray-500 dark:text-gray-400 mb-2 font-medium'>
            {liveMatch
              ? `Live (${matchToShow.league.name})`
              : `${formatMatchDate(matchToShow.date)} (${matchToShow.league.name})`}
          </p>
          <MatchCard fixture={matchToShow} teamId={teamId} isMain />
        </div>
      )}

      {/* Last match result (only if not showing live) */}
      {!liveMatch && lastMatch && (
        <div>
          <p className='text-[13px] text-gray-500 dark:text-gray-400 mb-2 font-medium'>
            Last Match ({lastMatch.league.name})
          </p>
          <MatchCard fixture={lastMatch} teamId={teamId} />
        </div>
      )}
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────

function MatchCard({
  fixture,
  teamId,
  isMain,
}: {
  fixture: FootballFixture;
  teamId: number;
  isMain?: boolean;
}) {
  const isHome = fixture.teams.home.id === teamId;
  const live = isMatchLive(fixture);
  const finished =
    fixture.status.short === "FT" ||
    fixture.status.short === "AET" ||
    fixture.status.short === "PEN";

  return (
    <div
      className={cn(
        "rounded-2xl p-4",
        isMain
          ? "bg-gray-100 dark:bg-gray-800"
          : "bg-gray-50 dark:bg-gray-800/60",
      )}>
      {/* Live badge only */}
      {live && (
        <div className='flex justify-center mb-3'>
          <span className='px-2.5 py-0.5 bg-red-500 text-white text-[11px] font-bold rounded-full animate-pulse'>
            LIVE {fixture.status.elapsed}&apos;
          </span>
        </div>
      )}

      {/* Teams and score */}
      <div className='flex items-center justify-between'>
        {/* Home team */}
        <div
          className={cn(
            "flex flex-col items-center gap-2 flex-1",
            !isHome && "opacity-80",
          )}>
          <div
            className={cn(
              "flex items-center justify-center",
              isMain ? "w-20 h-20" : "w-16 h-16",
              !finished && !live && "animate-logo-breathe",
            )}>
            <img
              src={fixture.teams.home.logo}
              alt={fixture.teams.home.name}
              className={cn(
                "object-contain",
                isMain ? "w-20 h-20" : "w-16 h-16",
              )}
            />
          </div>
          <span
            className={cn(
              "text-center leading-tight",
              isMain ? "text-[13px]" : "text-[12px]",
              isHome
                ? "font-semibold text-gray-900 dark:text-white"
                : "text-gray-600 dark:text-gray-400",
            )}>
            {fixture.teams.home.name}
          </span>
        </div>

        {/* Score / VS */}
        <div className='flex flex-col items-center px-4'>
          {finished || live ? (
            <>
              <div className='flex items-center gap-2'>
                <span
                  className={cn(
                    "text-[28px] font-bold",
                    fixture.teams.home.winner
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-400 dark:text-gray-500",
                  )}>
                  {fixture.goals.home}
                </span>
                <span className='text-[20px] text-gray-300 dark:text-gray-600'>
                  -
                </span>
                <span
                  className={cn(
                    "text-[28px] font-bold",
                    fixture.teams.away.winner
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-400 dark:text-gray-500",
                  )}>
                  {fixture.goals.away}
                </span>
              </div>
              <span className='text-[11px] text-gray-500 dark:text-gray-400'>
                {finished ? "Full Time" : `${fixture.status.elapsed}'`}
              </span>
            </>
          ) : (
            <span className='text-[17px] font-semibold text-gray-400 dark:text-gray-500'>
              vs
            </span>
          )}
        </div>

        {/* Away team */}
        <div
          className={cn(
            "flex flex-col items-center gap-2 flex-1",
            isHome && "opacity-80",
          )}>
          <div
            className={cn(
              "flex items-center justify-center",
              isMain ? "w-20 h-20" : "w-16 h-16",
              !finished && !live && "animate-logo-breathe",
            )}>
            <img
              src={fixture.teams.away.logo}
              alt={fixture.teams.away.name}
              className={cn(
                "object-contain",
                isMain ? "w-20 h-20" : "w-16 h-16",
              )}
            />
          </div>
          <span
            className={cn(
              "text-center leading-tight",
              isMain ? "text-[13px]" : "text-[12px]",
              !isHome
                ? "font-semibold text-gray-900 dark:text-white"
                : "text-gray-600 dark:text-gray-400",
            )}>
            {fixture.teams.away.name}
          </span>
        </div>
      </div>

      {/* Venue */}
      {fixture.venue && (
        <p className='text-[11px] text-gray-400 dark:text-gray-500 text-center mt-2'>
          📍 {fixture.venue}
        </p>
      )}
    </div>
  );
}

// ─── Fixtures Tab ─────────────────────────────────────────────────────

function FixturesTab({
  recentFixtures,
  upcomingFixtures,
  teamId,
  isLoading,
}: {
  recentFixtures: FootballFixture[];
  upcomingFixtures: FootballFixture[];
  teamId: number;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <svg
          className='w-6 h-6 text-gray-400 animate-spin'
          fill='none'
          viewBox='0 0 24 24'>
          <circle
            className='opacity-25'
            cx='12'
            cy='12'
            r='10'
            stroke='currentColor'
            strokeWidth='4'
          />
          <path
            className='opacity-75'
            fill='currentColor'
            d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
          />
        </svg>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Upcoming */}
      {upcomingFixtures.length > 0 && (
        <div>
          <p className='text-[13px] text-gray-500 dark:text-gray-400 mb-2 font-medium'>
            Upcoming
          </p>
          <div className='space-y-1'>
            {upcomingFixtures.map((f) => (
              <FixtureRow key={f.id} fixture={f} teamId={teamId} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Results */}
      {recentFixtures.length > 0 && (
        <div>
          <p className='text-[13px] text-gray-500 dark:text-gray-400 mb-2 font-medium'>
            Recent Results
          </p>
          <div className='space-y-1'>
            {recentFixtures.map((f) => (
              <FixtureRow key={f.id} fixture={f} teamId={teamId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FixtureRow({
  fixture,
  teamId,
}: {
  fixture: FootballFixture;
  teamId: number;
}) {
  const isHome = fixture.teams.home.id === teamId;
  const opponent = isHome ? fixture.teams.away : fixture.teams.home;
  const result = getMatchResult(fixture, teamId);
  const live = isMatchLive(fixture);
  const finished = result !== null;

  return (
    <div className='flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60'>
      {/* Result indicator */}
      <div
        className={cn(
          "w-1.5 h-8 rounded-full",
          result === "W"
            ? "bg-ios-green"
            : result === "L"
              ? "bg-ios-red"
              : result === "D"
                ? "bg-gray-400"
                : live
                  ? "bg-red-500 animate-pulse"
                  : "bg-gray-200 dark:bg-gray-700",
        )}
      />

      {/* Home/Away badge */}
      <span className='text-[10px] text-gray-400 dark:text-gray-500 w-3 font-medium'>
        {isHome ? "H" : "A"}
      </span>

      {/* Opponent */}
      <img
        src={opponent.logo}
        alt=''
        className='w-5 h-5 object-contain shrink-0'
      />
      <span className='text-[14px] text-gray-900 dark:text-white flex-1 truncate'>
        {opponent.name}
      </span>

      {/* Score or date */}
      {finished || live ? (
        <span
          className={cn(
            "text-[14px] font-semibold",
            result === "W"
              ? "text-ios-green"
              : result === "L"
                ? "text-ios-red"
                : "text-gray-500 dark:text-gray-400",
          )}>
          {fixture.goals.home} - {fixture.goals.away}
        </span>
      ) : (
        <span className='text-[12px] text-gray-500 dark:text-gray-400'>
          {formatMatchDate(fixture.date)}
        </span>
      )}
    </div>
  );
}

// ─── Standings Tab ────────────────────────────────────────────────────

function StandingsTab({
  standings,
  teamId,
  leagueName,
  isLoading,
}: {
  standings: StandingEntry[];
  teamId: number;
  leagueName: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <svg
          className='w-6 h-6 text-gray-400 animate-spin'
          fill='none'
          viewBox='0 0 24 24'>
          <circle
            className='opacity-25'
            cx='12'
            cy='12'
            r='10'
            stroke='currentColor'
            strokeWidth='4'
          />
          <path
            className='opacity-75'
            fill='currentColor'
            d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
          />
        </svg>
      </div>
    );
  }

  if (standings.length === 0) {
    return (
      <div className='text-center py-8'>
        <p className='text-[32px] mb-2'>📊</p>
        <p className='text-gray-500 dark:text-gray-400 text-[15px]'>
          Standings not available for {leagueName || "this league"}
        </p>
        <p className='text-gray-400 dark:text-gray-500 text-[13px] mt-1'>
          Supported: PL, La Liga, Bundesliga, Serie A, Ligue 1, CL
        </p>
      </div>
    );
  }

  return (
    <div className='overflow-x-auto -mx-2'>
      <table className='w-full text-[12px]'>
        <thead>
          <tr className='text-gray-500 dark:text-gray-400'>
            <th className='text-left py-1.5 pl-2 w-6'>#</th>
            <th className='text-left py-1.5'>Team</th>
            <th className='text-center py-1.5 w-6'>P</th>
            <th className='text-center py-1.5 w-6'>W</th>
            <th className='text-center py-1.5 w-6'>D</th>
            <th className='text-center py-1.5 w-6'>L</th>
            <th className='text-center py-1.5 w-8'>GD</th>
            <th className='text-center py-1.5 w-8 pr-2 font-bold'>Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry) => {
            const isMyTeam = entry.team.id === teamId;
            return (
              <tr
                key={entry.team.id}
                className={cn(
                  "border-t border-gray-100 dark:border-gray-800",
                  isMyTeam && "bg-ios-blue/10 dark:bg-ios-blue/20",
                )}>
                <td className='py-1.5 pl-2 text-gray-500 dark:text-gray-400'>
                  {entry.rank}
                </td>
                <td className='py-1.5'>
                  <div className='flex items-center gap-1.5'>
                    <img
                      src={entry.team.logo}
                      alt=''
                      className='w-4 h-4 object-contain shrink-0'
                    />
                    <span
                      className={cn(
                        "truncate max-w-30",
                        isMyTeam
                          ? "font-bold text-gray-900 dark:text-white"
                          : "text-gray-700 dark:text-gray-300",
                      )}>
                      {entry.team.name}
                    </span>
                  </div>
                </td>
                <td className='text-center py-1.5 text-gray-600 dark:text-gray-400'>
                  {entry.all.played}
                </td>
                <td className='text-center py-1.5 text-gray-600 dark:text-gray-400'>
                  {entry.all.win}
                </td>
                <td className='text-center py-1.5 text-gray-600 dark:text-gray-400'>
                  {entry.all.draw}
                </td>
                <td className='text-center py-1.5 text-gray-600 dark:text-gray-400'>
                  {entry.all.lose}
                </td>
                <td
                  className={cn(
                    "text-center py-1.5",
                    entry.goalsDiff > 0
                      ? "text-ios-green"
                      : entry.goalsDiff < 0
                        ? "text-ios-red"
                        : "text-gray-500",
                  )}>
                  {entry.goalsDiff > 0
                    ? `+${entry.goalsDiff}`
                    : entry.goalsDiff}
                </td>
                <td
                  className={cn(
                    "text-center py-1.5 pr-2 font-bold",
                    isMyTeam
                      ? "text-ios-blue"
                      : "text-gray-900 dark:text-white",
                  )}>
                  {entry.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
