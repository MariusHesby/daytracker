"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ActivityType,
  LogEntry,
  CoachData,
  CoachLineupEntry,
  CoachSubstitution,
  CoachPlayer,
  CoachConfig,
  FootballPosition,
  FOOTBALL_POSITIONS,
} from "@/types";
import { cn } from "@/lib/utils";

interface CoachMatchPanelProps {
  type: ActivityType;
  entry: LogEntry | null;
  onSave: (coachData: CoachData, value: string) => void;
  onUpdateConfig?: (updatedType: ActivityType) => void;
  disabled?: boolean;
}

function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function elapsedSeconds(startMs: number | null, now: number): number {
  if (!startMs) return 0;
  return Math.floor((now - startMs) / 1000);
}

// ─── pitch layout constants ───────────────────────────────────────────────────

/**
 * Zone 0 = GK (bottom of display), Zone 6 = Strikers (top).
 * Rows are rendered highest-zone-first (attack at top, GK at bottom).
 */
const POSITION_ZONE: Record<string, number> = {
  ST: 6,
  LW: 5,
  RW: 5,
  CF: 5,
  CAM: 4,
  LM: 3,
  CM: 3,
  RM: 3,
  CDM: 2,
  LB: 1,
  CB: 1,
  RB: 1,
  GK: 0,
};

/** Horizontal column within a zone: 0=left, 1=centre, 2=right */
const POSITION_COL: Record<string, number> = {
  LW: 0,
  LM: 0,
  LB: 0,
  GK: 1,
  CB: 1,
  CDM: 1,
  CM: 1,
  CAM: 1,
  CF: 1,
  ST: 1,
  RW: 2,
  RM: 2,
  RB: 2,
};

const POSITION_COLORS: Record<string, string> = {
  GK: "bg-yellow-400 text-yellow-900",
  LB: "bg-blue-400 text-blue-900",
  CB: "bg-blue-500 text-white",
  RB: "bg-blue-400 text-blue-900",
  CDM: "bg-teal-500 text-white",
  LM: "bg-green-400 text-green-900",
  CM: "bg-green-400 text-green-900",
  RM: "bg-green-400 text-green-900",
  CAM: "bg-lime-400 text-lime-900",
  LW: "bg-orange-400 text-orange-900",
  RW: "bg-orange-400 text-orange-900",
  CF: "bg-red-400 text-red-900",
  ST: "bg-red-500 text-white",
  Bench: "bg-gray-400 text-gray-900",
};

function getLineupMinutes(
  l: CoachLineupEntry,
  now: number,
  isRunning: boolean,
): number {
  const base = l.totalMinutesPlayed;
  if (l.onPitchSince && isRunning) {
    return base + Math.floor((now - l.onPitchSince) / 60000);
  }
  return base;
}

function computeSuggestion(
  pitchEntries: CoachLineupEntry[],
  benchEntries: CoachLineupEntry[],
  configPlayers: CoachPlayer[],
  now: number,
  isRunning: boolean,
  formerGKs: Set<string>,
  isFirstInHalf: boolean,
  subConsiderTime: boolean,
  subConsiderPosition: boolean,
  subConsiderKeeper: boolean,
  subConsiderSubOrder: boolean,
  substitutions: CoachSubstitution[],
): [string, string] | null {
  const validPitch = pitchEntries.filter((l) => l.position !== "GK");
  if (validPitch.length === 0 || benchEntries.length === 0) return null;

  const anyConsideration =
    subConsiderTime ||
    subConsiderPosition ||
    subConsiderKeeper ||
    subConsiderSubOrder;

  if (!anyConsideration || isFirstInHalf) {
    const pi = Math.floor(Math.random() * validPitch.length);
    const bi = Math.floor(Math.random() * benchEntries.length);
    return [validPitch[pi].playerId, benchEntries[bi].playerId];
  }

  const pitchScored = validPitch
    .map((l) => {
      let score = 0;
      if (subConsiderTime) score += getLineupMinutes(l, now, isRunning);
      // sub order: player who came on most recently gets lowest come-off score
      if (subConsiderSubOrder) {
        // Find the most recent sub index where this player came on
        let lastSubIndex = -1;
        for (let i = 0; i < substitutions.length; i++) {
          if (substitutions[i].playerOnId === l.playerId) lastSubIndex = i;
        }
        // Never subbed (lastSubIndex = -1) → highest bonus → comes off first
        // Most recently subbed (lastSubIndex = n-1) → bonus of 1 → comes off last
        score += substitutions.length - lastSubIndex;
      }
      return { ...l, score };
    })
    .sort((a, b) => b.score - a.score);

  const topPitchPosition = pitchScored[0]?.position;

  const benchScored = benchEntries
    .map((l) => {
      let score = 0;
      const player = configPlayers.find((p) => p.id === l.playerId);
      if (subConsiderTime) score -= getLineupMinutes(l, now, isRunning);
      if (subConsiderPosition && player && topPitchPosition) {
        if (player.preferredPosition === topPitchPosition) score += 5;
      }
      if (subConsiderKeeper && formerGKs.has(l.playerId)) {
        const isDefensive = ["CB", "LB", "RB"].includes(topPitchPosition ?? "");
        if (!isDefensive) score += 8;
      }
      if (subConsiderSubOrder) {
        // Player who last came ON earliest (or never) has been waiting longest → comes on first
        let lastOnIndex = -1;
        for (let i = 0; i < substitutions.length; i++) {
          if (substitutions[i].playerOnId === l.playerId) lastOnIndex = i;
        }
        score += substitutions.length - lastOnIndex;
      }
      return { ...l, score };
    })
    .sort((a, b) => b.score - a.score);

  return [pitchScored[0].playerId, benchScored[0].playerId];
}

function getPitchRows(players: CoachLineupEntry[]): CoachLineupEntry[][] {
  const zoneMap = new Map<number, CoachLineupEntry[]>();
  for (const l of players) {
    const zone = POSITION_ZONE[l.position] ?? 3;
    if (!zoneMap.has(zone)) zoneMap.set(zone, []);
    zoneMap.get(zone)!.push(l);
  }
  return [...zoneMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) =>
      [...row].sort(
        (a, b) =>
          (POSITION_COL[a.position] ?? 1) - (POSITION_COL[b.position] ?? 1),
      ),
    );
}

// ─── Formation helpers ────────────────────────────────────────────────────────

const DEFAULT_FORMATION: Record<number, FootballPosition[]> = {
  4: ["GK", "CB", "CM", "ST"],
  5: ["GK", "LB", "RB", "CM", "ST"],
  6: ["GK", "LB", "RB", "CM", "CAM", "ST"],
  7: ["GK", "LB", "CB", "RB", "CM", "CAM", "ST"],
  8: ["GK", "LB", "CB", "RB", "CM", "CM", "CAM", "ST"],
  9: ["GK", "LB", "CB", "RB", "CDM", "CM", "CM", "CAM", "ST"],
  10: ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "CAM", "ST"],
  11: ["GK", "LB", "CB", "CB", "RB", "CDM", "LM", "CM", "RM", "CAM", "ST"],
};

type FormationSlot = { pos: FootballPosition; entry: CoachLineupEntry | null };

function getFormationRows(slots: FormationSlot[]): FormationSlot[][] {
  const zoneMap = new Map<number, FormationSlot[]>();
  for (const slot of slots) {
    const zone = POSITION_ZONE[slot.pos] ?? 3;
    if (!zoneMap.has(zone)) zoneMap.set(zone, []);
    zoneMap.get(zone)!.push(slot);
  }
  return [...zoneMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) =>
      [...row].sort(
        (a, b) => (POSITION_COL[a.pos] ?? 1) - (POSITION_COL[b.pos] ?? 1),
      ),
    );
}

// ─── PlayerCard ───────────────────────────────────────────────────────────────

function PlayerCard({
  lineupEntry,
  playerName,
  playerNumber,
  minutes,
  isSelected,
  isTarget,
  switchRank,
  switchedAt,
  isSuggested,
  isBench,
  circleScale,
  isNextUp,
  onTap,
}: {
  lineupEntry: CoachLineupEntry;
  playerName: string;
  playerNumber: number;
  minutes: number;
  isSelected: boolean;
  isTarget: boolean;
  /** 1 = most recently switched (green), 2 = yellow, 3+ = red, null = never switched */
  switchRank: number | null;
  switchedAt: number | null;
  isSuggested?: boolean;
  /** Is this player on the bench? Suppresses colors and ring selection */
  isBench?: boolean;
  /** 0–1 scale factor for circle size on bench (0 = smallest, 1 = largest) */
  circleScale?: number;
  /** Rightmost bench player — show pulsing ring */
  isNextUp?: boolean;
  onTap: (e: React.MouseEvent) => void;
}) {
  const [flash, setFlash] = useState(false);
  const prevSwitchedAt = useRef<number | null>(null);

  useEffect(() => {
    if (switchedAt !== null && switchedAt !== prevSwitchedAt.current) {
      prevSwitchedAt.current = switchedAt;
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 340);
      return () => clearTimeout(id);
    }
  }, [switchedAt]);

  // Circle colors: bench always white; pitch: amber=selected, green=suggested, white otherwise
  const circleClass = isSelected
    ? "bg-amber-400 text-amber-900"
    : !isBench && isSuggested
      ? "bg-green-300 text-green-900"
      : "bg-white text-gray-900";

  // Circle diameter: bench uses 32–44px range based on circleScale, pitch uses 40px
  const baseSize = 40;
  const minSize = 32;
  const maxSize = 44;
  const circleSize =
    isBench && circleScale !== undefined
      ? Math.round(minSize + circleScale * (maxSize - minSize))
      : baseSize;

  const circleShadow = isSelected
    ? "0 0 0 3px rgba(251,191,36,0.7), 0 4px 12px rgba(0,0,0,0.5)"
    : isTarget
      ? "0 0 0 2px rgba(255,255,255,0.5), 0 4px 10px rgba(0,0,0,0.4)"
      : "0 2px 6px rgba(0,0,0,0.3)";

  const hasSwitched = !isBench && switchRank !== null;

  return (
    <button
      type='button'
      onClick={onTap}
      style={flash ? { animation: "playerSwitchFlash 0.32s ease-out" } : {}}
      className={cn(
        "flex flex-col items-center gap-1 py-3 px-2 rounded-2xl transition-all w-18.5 shrink-0",
        isSelected && !isBench && "scale-[1.08]",
      )}>
      {/* Pulsing ring for next-up bench player */}
      <div className='relative flex items-center justify-center'>
        {isNextUp && (
          <span
            className='absolute rounded-full animate-ping opacity-30 bg-white'
            style={{ width: circleSize + 10, height: circleSize + 10 }}
          />
        )}
        {/* Minutes in circle */}
        <div
          className={cn(
            "rounded-full font-bold text-[13px] flex items-center justify-center leading-none shrink-0 transition-all",
            circleClass,
          )}
          style={{
            width: circleSize,
            height: circleSize,
            boxShadow: circleShadow,
            fontSize: circleSize < 36 ? 11 : circleSize > 42 ? 14 : 13,
          }}>
          {minutes}&apos;
        </div>
        {/* Switched badge — tiny swap icon top-right */}
        {hasSwitched && (
          <span
            className='absolute flex items-center justify-center rounded-full bg-gray-700 border border-gray-600'
            style={{ width: 13, height: 13, top: -2, right: -2 }}>
            <svg viewBox='0 0 10 10' width='8' height='8' fill='none'>
              <path
                d='M2 3.5 L5 1 L8 3.5'
                stroke='white'
                strokeWidth='1.4'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <path
                d='M8 6.5 L5 9 L2 6.5'
                stroke='white'
                strokeWidth='1.4'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </span>
        )}
      </div>
      {/* Name */}
      <span
        className='text-white text-[15px] font-bold truncate w-full text-center leading-tight mt-0.5'
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
        {playerName.split(" ")[0]}
      </span>
      {/* Jersey number */}
      {playerNumber > 0 && (
        <span
          className='text-white/80 text-[11px] tabular-nums leading-none'
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
          #{playerNumber}
        </span>
      )}
    </button>
  );
}

// ─── PositionSelect (used in edit config sheet) ───────────────────────────────
function PositionSelect({
  value,
  onChange,
  className,
}: {
  value: FootballPosition;
  onChange: (v: FootballPosition) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [favorites, setFavorites] = React.useState<FootballPosition[]>(() => {
    try {
      const s = localStorage.getItem("coachPositionFavorites");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const toggleFav = (pos: FootballPosition, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(pos)
        ? prev.filter((p) => p !== pos)
        : [...prev, pos];
      try {
        localStorage.setItem("coachPositionFavorites", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const groups = React.useMemo(() => {
    const groupMap = new Map<string, typeof FOOTBALL_POSITIONS>();
    for (const p of FOOTBALL_POSITIONS) {
      if (!groupMap.has(p.group)) groupMap.set(p.group, []);
      groupMap.get(p.group)!.push(p);
    }
    const sections: { group: string; positions: typeof FOOTBALL_POSITIONS }[] =
      [];
    if (favorites.length > 0)
      sections.push({
        group: "Favorites",
        positions: FOOTBALL_POSITIONS.filter((p) =>
          favorites.includes(p.value),
        ),
      });
    groupMap.forEach((positions, group) => sections.push({ group, positions }));
    return sections;
  }, [favorites]);

  return (
    <div className={cn("relative", className)}>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='w-full flex items-center justify-between gap-1 px-2 py-2 rounded-lg text-[13px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600'>
        <span className='font-semibold'>{value}</span>
        <svg
          className='w-3 h-3 text-gray-400'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
          strokeWidth={2}>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M19 9l-7 7-7-7'
          />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            className='fixed inset-0 flex items-center justify-center p-4'
            style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10001 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}>
            <div className='w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 overflow-hidden flex flex-col max-h-[75vh]'>
              <div className='flex items-center justify-between px-5 pt-5 pb-3 shrink-0'>
                <h3 className='text-[18px] font-semibold text-gray-900 dark:text-white'>
                  Choose Position
                </h3>
                <button
                  type='button'
                  onClick={() => setOpen(false)}
                  className='w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500'>
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                    strokeWidth={2.5}>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
              <div className='overflow-y-auto px-3 pb-4'>
                {groups.map(({ group, positions }) => (
                  <div key={group} className='mb-1'>
                    <p className='text-[11px] font-semibold uppercase tracking-widest text-gray-400 px-2 py-2'>
                      {group === "Favorites" ? "⭐ Favorites" : group}
                    </p>
                    <div className='rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700/60'>
                      {positions.map((p, i) => (
                        <div
                          key={`${group}-${p.value}`}
                          className={cn(
                            "flex items-center",
                            i > 0 &&
                              "border-t border-gray-100 dark:border-gray-700/60",
                            value === p.value
                              ? "bg-ios-blue/10 dark:bg-ios-blue/20"
                              : "bg-white dark:bg-gray-800",
                          )}>
                          <button
                            type='button'
                            onClick={() => {
                              onChange(p.value);
                              setOpen(false);
                            }}
                            className='flex-1 flex items-center gap-3 px-4 py-3 text-left'>
                            <span
                              className={cn(
                                "w-11 shrink-0 text-center text-[13px] font-bold rounded-lg py-1",
                                value === p.value
                                  ? "bg-ios-blue text-white"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
                              )}>
                              {p.value}
                            </span>
                            <span
                              className={cn(
                                "text-[15px]",
                                value === p.value
                                  ? "text-ios-blue font-medium"
                                  : "text-gray-900 dark:text-white",
                              )}>
                              {p.label.split(" (")[0]}
                            </span>
                            {value === p.value && (
                              <svg
                                className='w-4 h-4 text-ios-blue shrink-0 ml-auto'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                                strokeWidth={2.5}>
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  d='M5 13l4 4L19 7'
                                />
                              </svg>
                            )}
                          </button>
                          <button
                            type='button'
                            onClick={(e) => toggleFav(p.value, e)}
                            className='px-3 py-3 shrink-0'>
                            <svg
                              className={cn(
                                "w-4 h-4",
                                favorites.includes(p.value)
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-gray-300 dark:text-gray-600",
                              )}
                              viewBox='0 0 24 24'
                              stroke='currentColor'
                              strokeWidth={1.5}>
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                d='M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function CoachMatchPanel({
  type,
  entry,
  onSave,
  onUpdateConfig,
  disabled,
}: CoachMatchPanelProps) {
  const config = type.coachConfig!;
  const teamSize = config.teamSize;

  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [halfStartTime, setHalfStartTime] = useState<number | null>(null);
  const [currentHalf, setCurrentHalf] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [lineup, setLineup] = useState<CoachLineupEntry[]>([]);
  const [substitutions, setSubstitutions] = useState<CoachSubstitution[]>([]);
  const [lastTradeTime, setLastTradeTime] = useState<number | null>(null);

  const [now, setNow] = useState(Date.now());
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showSubs, setShowSubs] = useState(false);
  const [recentSwitches, setRecentSwitches] = useState<Record<string, number>>(
    {},
  );
  const [formerGKs, setFormerGKs] = useState<Set<string>>(new Set());
  const [suggestionPair, setSuggestionPair] = useState<[string, string] | null>(
    null,
  );
  const [altSuggestionPair, setAltSuggestionPair] = useState<
    [string, string] | null
  >(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "halfTime" | "fullTime" | null
  >(null);
  const [showGoals, setShowGoals] = useState(false);
  const [showEmptySlots, setShowEmptySlots] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [homeTeamName, setHomeTeamName] = useState("");
  const [awayTeamName, setAwayTeamName] = useState("");

  // ── edit config state ────────────────────────────────────────────────────────
  const [showEditConfig, setShowEditConfig] = useState(false);
  const [editTeamSize, setEditTeamSize] = useState(config.teamSize);
  const [editHalfDuration, setEditHalfDuration] = useState(
    config.halfDurationMinutes,
  );
  const [editTradeTimer, setEditTradeTimer] = useState(
    config.tradeTimerMinutes,
  );
  const [editIsHome, setEditIsHome] = useState(config.isHomeTeam !== false);
  const [editConsiderTime, setEditConsiderTime] = useState(
    config.subConsiderTime ?? false,
  );
  const [editConsiderPosition, setEditConsiderPosition] = useState(
    config.subConsiderPosition ?? false,
  );
  const [editConsiderKeeper, setEditConsiderKeeper] = useState(
    config.subConsiderKeeper ?? false,
  );
  const [editConsiderSubOrder, setEditConsiderSubOrder] = useState(
    config.subConsiderSubOrder ?? false,
  );
  const [editVibrate, setEditVibrate] = useState(
    config.vibrateOnWarning ?? false,
  );
  const [editPlayers, setEditPlayers] = useState<CoachPlayer[]>(config.players);
  const [localPlayers, setLocalPlayers] = useState<CoachPlayer[]>(
    config.players,
  );
  const editTouchStartX = useRef<number>(0);
  const [editSwipedPlayerId, setEditSwipedPlayerId] = useState<string | null>(
    null,
  );

  type GoalEntry = { id: string; playerId: string; matchMinute: number };
  const [goals, setGoals] = useState<GoalEntry[]>([]);

  type UndoSnapshot = {
    lineup: CoachLineupEntry[];
    substitutions: CoachSubstitution[];
    lastTradeTime: number | null;
    recentSwitches: Record<string, number>;
    formerGKs: Set<string>;
  };
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  const lastSuggestionTradeRef = useRef<number | null>(null);
  const halfFirstSuggestedRef = useRef<Set<number>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initialized = useRef(false);

  // ── init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (entry?.coachData) {
      const d = entry.coachData;
      setMatchStartTime(d.matchStartTime);
      setHalfStartTime(d.halfStartTime);
      setCurrentHalf(d.currentHalf);
      setIsRunning(d.isRunning);
      setLineup(d.lineup);
      setSubstitutions(d.substitutions);
      setLastTradeTime(d.lastTradeTime);
      if (d.goals) setGoals(d.goals);
      if (d.homeTeamName) setHomeTeamName(d.homeTeamName);
      if (d.awayTeamName) setAwayTeamName(d.awayTeamName);
    } else {
      setLineup(
        config.players.map((p) => ({
          playerId: p.id,
          position: "Bench" as FootballPosition,
          onPitchSince: null,
          totalMinutesPlayed: 0,
        })),
      );
    }
  }, [entry, config, teamSize]);

  // ── sync localPlayers when config.players changes (e.g. after async DB save) ──
  const _configPlayersJson = JSON.stringify(config.players);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLocalPlayers(config.players);
  }, [_configPlayersJson]);

  // ── tick ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // ── derived ─────────────────────────────────────────────────────────────────
  const halfElapsed =
    isRunning && halfStartTime ? elapsedSeconds(halfStartTime, now) : 0;
  const matchMinute = Math.floor(
    ((currentHalf - 1) * config.halfDurationMinutes * 60 + halfElapsed) / 60,
  );
  const timeSinceLastTrade = isRunning
    ? Math.floor((now - (lastTradeTime ?? halfStartTime ?? now)) / 60000)
    : null;
  const tradeAlert =
    timeSinceLastTrade !== null &&
    timeSinceLastTrade >= config.tradeTimerMinutes;
  const timerWarning =
    timeSinceLastTrade !== null &&
    !tradeAlert &&
    timeSinceLastTrade >= config.tradeTimerMinutes - 1;

  // minutes remaining in current half (negative = overtime)
  const halfRemainingMinutes =
    isRunning && halfStartTime
      ? config.halfDurationMinutes - Math.floor(halfElapsed / 60)
      : config.halfDurationMinutes;

  const pitchPlayers = lineup.filter((l) => l.position !== "Bench");
  const benchPlayers = lineup.filter((l) => l.position === "Bench");

  // Formation slots for pitch rendering — show all positions as tappable slots
  const _allPositions = FOOTBALL_POSITIONS.filter(
    (p) => p.value !== "Bench",
  ).map((p) => p.value);
  const _usedSlotIds = new Set<string>();
  const formationSlots: FormationSlot[] = _allPositions.map((pos) => {
    const match = pitchPlayers.find(
      (l) => l.position === pos && !_usedSlotIds.has(l.playerId),
    );
    if (match) _usedSlotIds.add(match.playerId);
    return { pos, entry: match ?? null };
  });
  pitchPlayers
    .filter((l) => !_usedSlotIds.has(l.playerId))
    .forEach((l) => formationSlots.push({ pos: l.position, entry: l }));
  const formationRows = getFormationRows(formationSlots);

  const matchComplete =
    !isRunning && matchStartTime !== null && currentHalf > 2;
  const matchNotStarted = matchStartTime === null;

  const getPlayer = (id: string) => localPlayers.find((p) => p.id === id);

  function getPlayerMinutes(l: CoachLineupEntry): number {
    const base = l.totalMinutesPlayed;
    if (l.onPitchSince && isRunning) {
      return base + Math.floor((now - l.onPitchSince) / 60000);
    }
    return base;
  }

  // ── suggestion trigger ───────────────────────────────────────────────────────
  // ── Lock body when expanded (hides tab bar in all browsers) ─────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (expanded) {
      document.body.dataset.coachExpanded = "true";
    } else {
      delete document.body.dataset.coachExpanded;
    }
    return () => {
      delete document.body.dataset.coachExpanded;
    };
  }, [expanded]);

  useEffect(() => {
    if (!isRunning || matchComplete || benchPlayers.length === 0) return;
    if (timeSinceLastTrade === null) return;
    const warningMinute = config.tradeTimerMinutes - 1;
    if (timeSinceLastTrade !== warningMinute) return;
    if (lastSuggestionTradeRef.current === lastTradeTime) return;

    lastSuggestionTradeRef.current = lastTradeTime;
    const isFirstInHalf = !halfFirstSuggestedRef.current.has(currentHalf);
    halfFirstSuggestedRef.current.add(currentHalf);

    // Alert beep if enabled — uses Web Audio API (works on iOS + Android)
    // Falls back to vibration on Android if audio context is unavailable
    if (config.vibrateOnWarning && typeof window !== "undefined") {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const playBeep = (startTime: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.6, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
          };
          playBeep(ctx.currentTime, 0.18);
          playBeep(ctx.currentTime + 0.25, 0.18);
        }
      } catch {
        // Silently fall back to vibration on Android
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }

    const primary = computeSuggestion(
      pitchPlayers,
      benchPlayers,
      config.players,
      now,
      isRunning,
      formerGKs,
      isFirstInHalf,
      config.subConsiderTime ?? false,
      config.subConsiderPosition ?? false,
      config.subConsiderKeeper ?? false,
      config.subConsiderSubOrder ?? false,
      substitutions,
    );
    setSuggestionPair(primary);

    if (primary && benchPlayers.length > 1) {
      const altBench = benchPlayers.filter((l) => l.playerId !== primary[1]);
      const altPitch = pitchPlayers.filter(
        (l) => l.position !== "GK" && l.playerId !== primary[0],
      );
      if (altPitch.length > 0 && altBench.length > 0) {
        const alt = computeSuggestion(
          altPitch,
          altBench,
          config.players,
          now,
          isRunning,
          formerGKs,
          false,
          config.subConsiderTime ?? false,
          config.subConsiderPosition ?? false,
          config.subConsiderKeeper ?? false,
          config.subConsiderSubOrder ?? false,
          substitutions,
        );
        setAltSuggestionPair(alt);
      } else {
        setAltSuggestionPair(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeSinceLastTrade]);

  // ── coachData builder ───────────────────────────────────────────────────────
  const buildCoachData = useCallback(
    (
      overrides: Partial<CoachData> = {},
      lineupOverride?: CoachLineupEntry[],
      subsOverride?: CoachSubstitution[],
    ): CoachData => ({
      matchStartTime,
      halfStartTime,
      currentHalf,
      isRunning,
      lineup: lineupOverride ?? lineup,
      substitutions: subsOverride ?? substitutions,
      lastTradeTime,
      goals,
      homeTeamName: homeTeamName || undefined,
      awayTeamName: awayTeamName || undefined,
      ...overrides,
    }),
    [
      matchStartTime,
      halfStartTime,
      currentHalf,
      isRunning,
      lineup,
      substitutions,
      lastTradeTime,
      goals,
      homeTeamName,
      awayTeamName,
    ],
  );

  function buildValue(
    half: number,
    running: boolean,
    complete: boolean,
  ): string {
    if (complete) return "Match Complete";
    if (!running && matchStartTime === null) return "";
    return `${half === 1 ? "1st" : "2nd"} Half`;
  }

  function freezeMinutes(
    lu: CoachLineupEntry[],
    t: number,
  ): CoachLineupEntry[] {
    return lu.map((l) => {
      if (l.position !== "Bench" && l.onPitchSince) {
        return {
          ...l,
          totalMinutesPlayed:
            l.totalMinutesPlayed + Math.floor((t - l.onPitchSince) / 60000),
          onPitchSince: null,
        };
      }
      return l;
    });
  }

  // ── match controls ──────────────────────────────────────────────────────────
  function handleStartMatch() {
    const t = Date.now();
    const nl = lineup.map((l) =>
      l.position !== "Bench" ? { ...l, onPitchSince: t } : l,
    );
    setMatchStartTime(t);
    setHalfStartTime(t);
    setCurrentHalf(1);
    setIsRunning(true);
    setLastTradeTime(t);
    setLineup(nl);
    setSuggestionPair(null);
    setAltSuggestionPair(null);
    setFormerGKs(new Set());
    lastSuggestionTradeRef.current = null;
    halfFirstSuggestedRef.current = new Set();
    onSave(
      buildCoachData(
        {
          matchStartTime: t,
          halfStartTime: t,
          currentHalf: 1,
          isRunning: true,
          lastTradeTime: t,
        },
        nl,
      ),
      "1st Half",
    );
  }

  function handlePause() {
    const t = Date.now();
    const nl = freezeMinutes(lineup, t);
    setIsRunning(false);
    setLineup(nl);
    onSave(
      buildCoachData({ isRunning: false }, nl),
      buildValue(currentHalf, false, false),
    );
  }

  function handleResume() {
    const t = Date.now();
    const nl = lineup.map((l) =>
      l.position !== "Bench" ? { ...l, onPitchSince: t } : l,
    );
    setIsRunning(true);
    setLineup(nl);
    onSave(
      buildCoachData({ isRunning: true }, nl),
      buildValue(currentHalf, true, false),
    );
  }

  function handleHalfTime() {
    const t = Date.now();
    const nl = freezeMinutes(lineup, t);
    setIsRunning(false);
    setCurrentHalf(2);
    setHalfStartTime(null);
    setLineup(nl);
    onSave(
      buildCoachData(
        { isRunning: false, currentHalf: 2, halfStartTime: null },
        nl,
      ),
      "Half Time",
    );
  }

  function handleStartSecondHalf() {
    const t = Date.now();
    const nl = lineup.map((l) =>
      l.position !== "Bench" ? { ...l, onPitchSince: t } : l,
    );
    setHalfStartTime(t);
    setIsRunning(true);
    setLastTradeTime(t);
    setLineup(nl);
    setSuggestionPair(null);
    setAltSuggestionPair(null);
    lastSuggestionTradeRef.current = null;
    onSave(
      buildCoachData(
        { halfStartTime: t, isRunning: true, lastTradeTime: t },
        nl,
      ),
      "2nd Half",
    );
  }

  function handleEndMatch() {
    const t = Date.now();
    const nl = freezeMinutes(lineup, t);
    setIsRunning(false);
    setCurrentHalf(3);
    setLineup(nl);
    onSave(
      buildCoachData({ isRunning: false, currentHalf: 3 }, nl),
      "Match Complete",
    );
  }

  // ── tap-to-swap/sub ──────────────────────────────────────────────────────────
  function handlePlayerTap(playerId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled || matchComplete) return;

    if (selectedPlayerId === null) {
      setSelectedPlayerId(playerId);
      // If tapping a bench player, compute a pitch suggestion
      const entry = lineup.find((l) => l.playerId === playerId);
      if (entry?.position === "Bench") {
        const benched = [entry];
        const suggestion = computeSuggestion(
          pitchPlayers,
          benched,
          config.players,
          now,
          isRunning,
          formerGKs,
          false,
          config.subConsiderTime ?? false,
          config.subConsiderPosition ?? false,
          config.subConsiderKeeper ?? false,
          config.subConsiderSubOrder ?? false,
          substitutions,
        );
        if (suggestion) {
          setSuggestionPair(suggestion);
          setAltSuggestionPair(null);
        }
      }
      return;
    }
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      return;
    }

    const srcEntry = lineup.find((l) => l.playerId === selectedPlayerId);
    const tgtEntry = lineup.find((l) => l.playerId === playerId);
    if (!srcEntry || !tgtEntry) {
      setSelectedPlayerId(null);
      return;
    }

    const srcOnPitch = srcEntry.position !== "Bench";
    const tgtOnPitch = tgtEntry.position !== "Bench";

    // Save snapshot before mutating state
    setUndoStack((prev) => [
      {
        lineup,
        substitutions,
        lastTradeTime,
        recentSwitches,
        formerGKs: new Set(formerGKs),
      },
      ...prev.slice(0, 9),
    ]);

    if (srcOnPitch && tgtOnPitch) {
      // Swap positions on pitch — no sub record
      const t = Date.now();
      const nl = lineup.map((l) => {
        if (l.playerId === selectedPlayerId)
          return { ...l, position: tgtEntry.position };
        if (l.playerId === playerId)
          return { ...l, position: srcEntry.position };
        return l;
      });
      setLineup(nl);
      setRecentSwitches((prev) => ({
        ...prev,
        [selectedPlayerId!]: t,
        [playerId]: t,
      }));
      onSave(buildCoachData({}, nl), buildValue(currentHalf, isRunning, false));
    } else {
      // Substitution
      const t = Date.now();
      const pitchEntry = srcOnPitch ? srcEntry : tgtEntry;
      const benchEntry = srcOnPitch ? tgtEntry : srcEntry;

      const nl = lineup.map((l) => {
        if (l.playerId === pitchEntry.playerId) {
          const addedMin =
            l.onPitchSince && isRunning
              ? Math.floor((t - l.onPitchSince) / 60000)
              : 0;
          return {
            ...l,
            position: "Bench" as FootballPosition,
            totalMinutesPlayed: l.totalMinutesPlayed + addedMin,
            onPitchSince: null,
          };
        }
        if (l.playerId === benchEntry.playerId) {
          return {
            ...l,
            position: pitchEntry.position,
            onPitchSince: isRunning ? t : null,
          };
        }
        return l;
      });
      if (pitchEntry.position === "GK") {
        setFormerGKs((prev) => new Set([...prev, pitchEntry.playerId]));
      }
      const sub: CoachSubstitution = {
        id: crypto.randomUUID(),
        timestamp: t,
        playerOffId: pitchEntry.playerId,
        playerOnId: benchEntry.playerId,
        matchMinute,
      };
      const ns = [...substitutions, sub];
      setLineup(nl);
      setSubstitutions(ns);
      setLastTradeTime(t);
      setRecentSwitches((prev) => ({
        ...prev,
        [pitchEntry.playerId]: t,
        [benchEntry.playerId]: t,
      }));
      onSave(
        buildCoachData({ lastTradeTime: t }, nl, ns),
        buildValue(currentHalf, isRunning, false),
      );
    }
    setSuggestionPair(null);
    setAltSuggestionPair(null);
    setSelectedPlayerId(null);
  }

  function handleRegret() {
    if (undoStack.length === 0) return;
    const [snap, ...rest] = undoStack;
    setUndoStack(rest);
    setLineup(snap.lineup);
    setSubstitutions(snap.substitutions);
    setLastTradeTime(snap.lastTradeTime);
    setRecentSwitches(snap.recentSwitches);
    setFormerGKs(snap.formerGKs);
    setSuggestionPair(null);
    setAltSuggestionPair(null);
    setSelectedPlayerId(null);
    onSave(
      buildCoachData(
        { lastTradeTime: snap.lastTradeTime },
        snap.lineup,
        snap.substitutions,
      ),
      buildValue(currentHalf, isRunning, false),
    );
  }

  function handleAssignToSlot(playerId: string, pos: FootballPosition) {
    setUndoStack((prev) => [
      {
        lineup,
        substitutions,
        lastTradeTime,
        recentSwitches,
        formerGKs: new Set(formerGKs),
      },
      ...prev.slice(0, 9),
    ]);
    const t = Date.now();
    const nl = lineup.map((l) =>
      l.playerId === playerId
        ? { ...l, position: pos, onPitchSince: isRunning ? t : null }
        : l,
    );
    setLineup(nl);
    onSave(
      buildCoachData({}, nl),
      buildValue(currentHalf, isRunning, matchComplete),
    );
  }

  function handleResetTimePlayed() {
    const nl = lineup.map((l) => ({
      ...l,
      totalMinutesPlayed: 0,
      onPitchSince: null,
    }));
    setUndoStack([
      {
        lineup,
        substitutions,
        lastTradeTime,
        recentSwitches,
        formerGKs: new Set(formerGKs),
      },
      ...undoStack.slice(0, 9),
    ]);
    setMatchStartTime(null);
    setHalfStartTime(null);
    setCurrentHalf(1);
    setIsRunning(false);
    setSubstitutions([]);
    setGoals([]);
    setLastTradeTime(null);
    setRecentSwitches({});
    setFormerGKs(new Set());
    setLineup(nl);
    setShowResetConfirm(false);
    onSave(
      {
        matchStartTime: null,
        halfStartTime: null,
        currentHalf: 1,
        isRunning: false,
        lineup: nl,
        substitutions: [],
        lastTradeTime: null,
        goals: [],
        homeTeamName: homeTeamName || undefined,
        awayTeamName: awayTeamName || undefined,
      },
      "",
    );
  }

  function handleAddGoal(playerId: string) {
    const g: GoalEntry = {
      id: crypto.randomUUID(),
      playerId,
      matchMinute,
    };
    const next = [...goals, g];
    setGoals(next);
    onSave(
      { ...buildCoachData(), goals: next },
      buildValue(currentHalf, isRunning, matchComplete),
    );
  }

  function handleRemoveGoal(playerId: string) {
    setGoals((prev) => {
      const idx = [...prev].reverse().findIndex((g) => g.playerId === playerId);
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      const next = prev.filter((_, i) => i !== realIdx);
      onSave(
        { ...buildCoachData(), goals: next },
        buildValue(currentHalf, isRunning, matchComplete),
      );
      return next;
    });
  }

  // ── render ───────────────────────────────────────────────────────────────────
  function getSwitchRank(playerId: string): number | null {
    if (!recentSwitches[playerId]) return null;
    const sorted = Object.entries(recentSwitches)
      .sort(([, a], [, b]) => b - a)
      .map(([id]) => id);
    const rank = sorted.indexOf(playerId) + 1;
    return Math.min(rank, 3);
  }

  const halfLabel = matchComplete
    ? "Full Time"
    : matchNotStarted
      ? "Kick Off"
      : isRunning
        ? `${currentHalf === 1 ? "1st" : "2nd"} Half`
        : currentHalf === 2 && halfStartTime === null
          ? "Half Time"
          : "Paused";

  const content = (
    <div
      className={cn("select-none", !expanded && "space-y-3")}
      style={
        expanded
          ? {
              position: "fixed" as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              display: "flex",
              flexDirection: "column" as const,
              background: "#030712",
              overflow: "hidden",
              pointerEvents: "auto",
            }
          : undefined
      }>
      <style>{`
        @keyframes playerSwitchFlash {
          0%   { transform: scale(1);    filter: brightness(1); }
          28%  { transform: scale(1.14); filter: brightness(1.65); }
          100% { transform: scale(1);    filter: brightness(1); }
        }
      `}</style>
      {/* ── Scrollable main area ── */}
      <div
        className={cn(
          expanded
            ? "flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-2 space-y-3"
            : "contents",
        )}>
        {/* ── Team name heading ── */}
        {(homeTeamName || awayTeamName) && (
          <div className='flex items-center justify-center gap-2 px-1 pt-3 pb-0'>
            <span className='text-[17px] font-bold text-white truncate max-w-[40%]'>
              {homeTeamName || "Home"}
            </span>
            <span className='text-[13px] text-gray-500 font-medium'>vs</span>
            <span className='text-[17px] font-bold text-white truncate max-w-[40%]'>
              {awayTeamName || "Away"}
            </span>
          </div>
        )}

        {/* ── Match clock ── */}
        <div className='rounded-2xl bg-gray-950 dark:bg-black/80 overflow-hidden'>
          <div className='flex items-end justify-between px-5 py-4'>
            {/* Numbers group – left */}
            <div className='flex items-end gap-5'>
              <div>
                <p className='text-[11px] text-gray-400 uppercase tracking-widest font-semibold'>
                  {halfLabel}
                </p>
                <p
                  className={cn(
                    "text-[40px] font-bold tabular-nums leading-none mt-1",
                    tradeAlert
                      ? "text-red-500"
                      : timerWarning
                        ? "text-yellow-400"
                        : "text-white",
                  )}>
                  {matchNotStarted ? "00:00" : fmtClock(halfElapsed)}
                </p>
              </div>

              {!matchNotStarted && (
                <div className='mb-0.5'>
                  <p className='text-[11px] uppercase tracking-widest font-semibold text-gray-400'>
                    {halfRemainingMinutes < 0 ? "ET" : "Min"}
                  </p>
                  <p
                    className={cn(
                      "text-[34px] font-bold tabular-nums leading-none mt-1",
                      halfRemainingMinutes < 0 ? "text-red-500" : "text-white",
                    )}>
                    {halfRemainingMinutes < 0
                      ? `+${Math.abs(halfRemainingMinutes)}`
                      : halfRemainingMinutes}
                    &apos;
                  </p>
                </div>
              )}
            </div>

            {/* Icons group – right */}
            <div className='flex flex-row gap-1.5 items-center'>
              {matchNotStarted && (
                <button
                  type='button'
                  onClick={handleStartMatch}
                  disabled={disabled}
                  className='px-4 py-2 rounded-full text-[14px] font-semibold bg-green-500 text-white active:opacity-80'>
                  Kick Off
                </button>
              )}
              {!matchNotStarted &&
                !matchComplete &&
                isRunning &&
                currentHalf === 1 && (
                  <>
                    {/* Half Time icon */}
                    <button
                      type='button'
                      onClick={() => setConfirmAction("halfTime")}
                      title='Half Time'
                      className='w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500 text-white active:opacity-80'>
                      <svg
                        width='17'
                        height='17'
                        viewBox='0 0 17 17'
                        fill='currentColor'>
                        <rect
                          x='3.5'
                          y='1.5'
                          width='1.8'
                          height='14'
                          rx='0.9'
                        />
                        <polygon points='5.3,1.5 14.5,5.5 5.3,9.5' />
                      </svg>
                    </button>
                    {/* Pause icon */}
                    <button
                      type='button'
                      onClick={handlePause}
                      title='Pause'
                      className='w-10 h-10 flex items-center justify-center rounded-xl bg-gray-700 text-white active:opacity-80'>
                      <svg
                        width='16'
                        height='16'
                        viewBox='0 0 16 16'
                        fill='currentColor'>
                        <rect x='2.5' y='2' width='4' height='12' rx='1.5' />
                        <rect x='9.5' y='2' width='4' height='12' rx='1.5' />
                      </svg>
                    </button>
                  </>
                )}
              {!matchNotStarted &&
                !matchComplete &&
                isRunning &&
                currentHalf === 2 && (
                  <>
                    {/* Full Time icon */}
                    <button
                      type='button'
                      onClick={() => setConfirmAction("fullTime")}
                      title='Full Time'
                      className='w-10 h-10 flex items-center justify-center rounded-xl bg-red-500 text-white active:opacity-80'>
                      <svg
                        width='14'
                        height='14'
                        viewBox='0 0 14 14'
                        fill='currentColor'>
                        <rect x='1' y='1' width='12' height='12' rx='2.5' />
                      </svg>
                    </button>
                    {/* Pause icon */}
                    <button
                      type='button'
                      onClick={handlePause}
                      title='Pause'
                      className='w-10 h-10 flex items-center justify-center rounded-xl bg-gray-700 text-white active:opacity-80'>
                      <svg
                        width='16'
                        height='16'
                        viewBox='0 0 16 16'
                        fill='currentColor'>
                        <rect x='2.5' y='2' width='4' height='12' rx='1.5' />
                        <rect x='9.5' y='2' width='4' height='12' rx='1.5' />
                      </svg>
                    </button>
                  </>
                )}
              {!matchNotStarted &&
                !matchComplete &&
                !isRunning &&
                currentHalf === 1 && (
                  <button
                    type='button'
                    onClick={handleResume}
                    className='px-3 py-2 rounded-full text-[13px] font-semibold bg-green-500 text-white active:opacity-80'>
                    Resume
                  </button>
                )}
              {!matchNotStarted &&
                !matchComplete &&
                !isRunning &&
                currentHalf === 2 &&
                halfStartTime === null && (
                  <button
                    type='button'
                    onClick={handleStartSecondHalf}
                    className='px-3 py-2 rounded-full text-[13px] font-semibold bg-green-500 text-white active:opacity-80'>
                    2nd Half
                  </button>
                )}
              {!matchNotStarted &&
                !matchComplete &&
                !isRunning &&
                currentHalf === 2 &&
                halfStartTime !== null && (
                  <button
                    type='button'
                    onClick={handleResume}
                    className='px-3 py-2 rounded-full text-[13px] font-semibold bg-green-500 text-white active:opacity-80'>
                    Resume
                  </button>
                )}
            </div>
          </div>
        </div>

        {/* ── Pitch ── */}
        <div
          className='relative rounded-2xl overflow-hidden'
          style={{
            background:
              "linear-gradient(180deg, #1d7032 0%, #1e7534 55%, #186028 100%)",
          }}
          onClick={() => setSelectedPlayerId(null)}>
          {/* Pitch markings SVG — shows from centre circle down to own goal */}
          <svg
            className='absolute inset-0 w-full h-full pointer-events-none'
            viewBox='0 58 100 92'
            preserveAspectRatio='none'
            style={{ opacity: 0.22 }}>
            {/* Outer boundary (top is clipped, side lines + bottom goal line visible) */}
            <rect
              x='2'
              y='2'
              width='96'
              height='146'
              fill='none'
              stroke='white'
              strokeWidth='0.8'
            />
            {/* Centre line */}
            <line
              x1='2'
              y1='75'
              x2='98'
              y2='75'
              stroke='white'
              strokeWidth='0.6'
            />
            {/* Own-goal penalty area */}
            <rect
              x='25'
              y='128'
              width='50'
              height='20'
              fill='none'
              stroke='white'
              strokeWidth='0.5'
            />
            {/* Own-goal box */}
            <rect
              x='36'
              y='140'
              width='28'
              height='8'
              fill='none'
              stroke='white'
              strokeWidth='0.5'
            />
          </svg>

          {/* Score overlay — top left of pitch */}
          {goals.length > 0 &&
            (() => {
              const ourGoals = goals.filter(
                (g) => g.playerId !== "__away__",
              ).length;
              const theirGoals = goals.filter(
                (g) => g.playerId === "__away__",
              ).length;
              const isHome = config.isHomeTeam !== false;
              const left = isHome ? ourGoals : theirGoals;
              const right = isHome ? theirGoals : ourGoals;
              return (
                <div className='absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/50 rounded-xl px-2.5 py-1 backdrop-blur-sm'>
                  <span className='text-white font-bold text-[17px] tabular-nums leading-none'>
                    {left}
                  </span>
                  <span className='text-white/40 text-[13px] leading-none'>
                    –
                  </span>
                  <span className='text-white font-bold text-[17px] tabular-nums leading-none'>
                    {right}
                  </span>
                </div>
              );
            })()}

          {/* Hide/show empty slots toggle */}
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              setShowEmptySlots((v) => !v);
            }}
            className='absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/60 active:opacity-60'>
            {showEmptySlots ? (
              <svg
                viewBox='0 0 24 24'
                width='15'
                height='15'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94' />
                <path d='M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19' />
                <line x1='1' y1='1' x2='23' y2='23' />
              </svg>
            ) : (
              <svg
                viewBox='0 0 24 24'
                width='15'
                height='15'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                <circle cx='12' cy='12' r='3' />
              </svg>
            )}
          </button>

          {/* Players + empty position slots */}
          <div className='relative z-10 flex flex-col justify-between gap-2 py-5 px-3 min-h-[307px]'>
            {formationRows.map((row, rowIdx) => (
              <div key={rowIdx} className='flex justify-around items-end'>
                {row.map((slot, si) => {
                  if (slot.entry) {
                    const p = getPlayer(slot.entry.playerId);
                    if (!p) return null;
                    return (
                      <PlayerCard
                        key={slot.entry.playerId}
                        lineupEntry={slot.entry}
                        playerName={p.name}
                        playerNumber={p.number}
                        minutes={getPlayerMinutes(slot.entry)}
                        isSelected={selectedPlayerId === slot.entry.playerId}
                        isTarget={
                          !!selectedPlayerId &&
                          selectedPlayerId !== slot.entry.playerId
                        }
                        switchRank={getSwitchRank(slot.entry.playerId)}
                        switchedAt={recentSwitches[slot.entry.playerId] ?? null}
                        isSuggested={
                          !!suggestionPair &&
                          suggestionPair[0] === slot.entry.playerId
                        }
                        onTap={(e) => handlePlayerTap(slot.entry!.playerId, e)}
                      />
                    );
                  }
                  if (!showEmptySlots) return null;
                  const hasBenchSelected =
                    !!selectedPlayerId &&
                    benchPlayers.some((l) => l.playerId === selectedPlayerId);
                  return (
                    <button
                      key={`empty-${slot.pos}-${si}`}
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasBenchSelected) {
                          handleAssignToSlot(selectedPlayerId!, slot.pos);
                          setSelectedPlayerId(null);
                        }
                      }}
                      className='flex flex-col items-center gap-1 py-3 px-2 w-[74px] shrink-0 active:opacity-60'>
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full border-2 border-dashed flex items-center justify-center",
                          hasBenchSelected
                            ? "border-amber-400/70 bg-amber-400/10"
                            : "border-white/25",
                        )}>
                        <svg
                          viewBox='0 0 24 24'
                          width='14'
                          height='14'
                          fill='none'
                          stroke='rgba(255,255,255,0.4)'
                          strokeWidth='2.5'
                          strokeLinecap='round'
                          strokeLinejoin='round'>
                          <line x1='12' y1='5' x2='12' y2='19' />
                          <line x1='5' y1='12' x2='19' y2='12' />
                        </svg>
                      </div>
                      <span className='text-white/30 text-[12px] font-bold'>
                        {slot.pos}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {formationRows.length === 0 && (
              <div className='flex-1 flex items-center justify-center'>
                <p className='text-white/30 text-[14px]'>No players on pitch</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Players pool ── */}
        {benchPlayers.length > 0 &&
          (() => {
            const sortedBench = [...benchPlayers].sort((a, b) => {
              const ta = recentSwitches[a.playerId] ?? 0;
              const tb = recentSwitches[b.playerId] ?? 0;
              return tb - ta;
            });
            const n = sortedBench.length;
            return (
              <div
                className='rounded-2xl px-3 py-3'
                style={{ background: "rgba(12, 16, 25, 0.8)" }}
                onClick={() => setSelectedPlayerId(null)}>
                <div className='flex flex-wrap gap-x-1 gap-y-0 justify-start items-start'>
                  {sortedBench.map((l, i) => {
                    const p = getPlayer(l.playerId);
                    if (!p) return null;
                    const isNextUp = i === n - 1;
                    return (
                      <PlayerCard
                        key={l.playerId}
                        lineupEntry={l}
                        playerName={p.name}
                        playerNumber={p.number}
                        minutes={getPlayerMinutes(l)}
                        isSelected={selectedPlayerId === l.playerId}
                        isTarget={false}
                        switchRank={getSwitchRank(l.playerId)}
                        switchedAt={recentSwitches[l.playerId] ?? null}
                        isSuggested={
                          !!suggestionPair && suggestionPair[1] === l.playerId
                        }
                        isBench={true}
                        circleScale={0.5}
                        isNextUp={isNextUp}
                        onTap={(e) => handlePlayerTap(l.playerId, e)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })()}

        {/* ── Substitutions log (collapsible) ── */}
        {substitutions.length > 0 && (
          <div className='rounded-2xl overflow-hidden border border-gray-200/15 dark:border-gray-700/25'>
            <button
              type='button'
              onClick={() => setShowSubs((v) => !v)}
              className='w-full flex items-center justify-between px-4 py-3 bg-white/5 dark:bg-white/5'>
              <p className='text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest'>
                Substitutions ({substitutions.length})
              </p>
              <svg
                className={cn(
                  "w-4 h-4 text-gray-400 transition-transform",
                  showSubs && "rotate-180",
                )}
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            </button>
            {showSubs && (
              <div className='px-4 pb-3 pt-1 space-y-0 bg-white/5 dark:bg-white/5'>
                {substitutions.map((sub, i) => {
                  const off = getPlayer(sub.playerOffId);
                  const on = getPlayer(sub.playerOnId);
                  return (
                    <div
                      key={sub.id}
                      className={cn(
                        "flex items-center gap-2 text-[13px] py-2",
                        i > 0 && "border-t border-white/10",
                      )}>
                      <span className='text-gray-500 w-7 shrink-0 tabular-nums font-semibold'>
                        {sub.matchMinute}&apos;
                      </span>
                      <span className='text-red-400 font-semibold'>
                        ↓{" "}
                        {off
                          ? `${off.number ? "#" + off.number + " " : ""}${off.name}`
                          : "?"}
                      </span>
                      <span className='text-gray-500'>→</span>
                      <span className='text-green-400 font-semibold'>
                        ↑{" "}
                        {on
                          ? `${on.number ? "#" + on.number + " " : ""}${on.name}`
                          : "?"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {/* end scrollable area */}

      {/* ── Bottom icon bar ── */}
      <div
        className={cn(
          "flex justify-between items-center px-1",
          expanded && "bg-gray-950 px-5 py-5 pb-8",
        )}>
        {/* Regret / undo */}
        <button
          type='button'
          onClick={handleRegret}
          disabled={undoStack.length === 0}
          title='Undo last action'
          className='w-9 h-9 flex items-center justify-center rounded-xl text-orange-400 active:opacity-60 disabled:opacity-30 disabled:pointer-events-none'>
          <svg
            viewBox='0 0 24 24'
            width='20'
            height='20'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'>
            <path d='M3 10h11a5 5 0 0 1 0 10H3' />
            <polyline points='7 6 3 10 7 14' />
          </svg>
        </button>

        {/* Goal */}
        <button
          type='button'
          onClick={() => setShowGoals(true)}
          title='Goals'
          className='h-11 px-6 flex items-center justify-center rounded-xl bg-white/10 text-white border border-orange-400/60 active:opacity-60'>
          <span className='text-[13px] font-black tracking-widest'>GOAL</span>
        </button>

        {/* Expand / contract */}
        <button
          type='button'
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Contract" : "Expand"}
          className='w-9 h-9 flex items-center justify-center rounded-xl text-orange-400 active:opacity-60'>
          {expanded ? (
            <svg
              viewBox='0 0 24 24'
              width='20'
              height='20'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'>
              <polyline points='4 14 10 14 10 20' />
              <polyline points='20 10 14 10 14 4' />
              <line x1='10' y1='14' x2='3' y2='21' />
              <line x1='21' y1='3' x2='14' y2='10' />
            </svg>
          ) : (
            <svg
              viewBox='0 0 24 24'
              width='20'
              height='20'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'>
              <polyline points='15 3 21 3 21 9' />
              <polyline points='9 21 3 21 3 15' />
              <line x1='21' y1='3' x2='14' y2='10' />
              <line x1='3' y1='21' x2='10' y2='14' />
            </svg>
          )}
        </button>

        {/* Reset time played */}
        <button
          type='button'
          onClick={() => setShowResetConfirm(true)}
          title='Reset time played'
          className='w-9 h-9 flex items-center justify-center rounded-xl text-orange-400 active:opacity-60'>
          <svg
            viewBox='0 0 24 24'
            width='20'
            height='20'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'>
            <path d='M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8' />
            <path d='M21 3v5h-5' />
            <line x1='12' y1='8' x2='12' y2='12' />
            <line x1='12' y1='16' x2='12.01' y2='16' />
          </svg>
        </button>

        {/* Edit config */}
        {onUpdateConfig && (
          <button
            type='button'
            onClick={() => {
              setEditTeamSize(config.teamSize);
              setEditHalfDuration(config.halfDurationMinutes);
              setEditTradeTimer(config.tradeTimerMinutes);
              setEditIsHome(config.isHomeTeam !== false);
              setEditConsiderTime(config.subConsiderTime ?? false);
              setEditConsiderPosition(config.subConsiderPosition ?? false);
              setEditConsiderKeeper(config.subConsiderKeeper ?? false);
              setEditConsiderSubOrder(config.subConsiderSubOrder ?? false);
              setEditVibrate(config.vibrateOnWarning ?? false);
              setEditPlayers([...config.players]);
              setShowEditConfig(true);
            }}
            title='Edit team setup'
            className='w-9 h-9 flex items-center justify-center rounded-xl text-orange-400 active:opacity-60'>
            <svg
              viewBox='0 0 24 24'
              width='20'
              height='20'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'>
              <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
              <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
            </svg>
          </button>
        )}
      </div>

      {/* ── Edit Config Sheet ── */}
      {showEditConfig &&
        onUpdateConfig &&
        createPortal(
          <div
            className='fixed inset-0 flex items-end'
            style={{ background: "rgba(0,0,0,0.65)", zIndex: 10000 }}
            onClick={() => setShowEditConfig(false)}>
            <div
              className='w-full rounded-t-2xl bg-ios-card-dark overflow-hidden flex flex-col max-h-[92vh]'
              onClick={(e) => e.stopPropagation()}>
              {/* Handle + header */}
              <div className='flex justify-center pt-3 pb-1 shrink-0'>
                <div className='w-10 h-1 rounded-full bg-white/20' />
              </div>
              <div className='flex items-center justify-between px-5 pt-2 pb-4 shrink-0'>
                <p className='text-[18px] font-semibold text-white'>
                  Team Setup
                </p>
                <button
                  type='button'
                  onClick={() => {
                    onSave(
                      buildCoachData(),
                      buildValue(currentHalf, isRunning, matchComplete),
                    );
                    setShowEditConfig(false);
                  }}
                  className='text-[15px] text-ios-blue active:opacity-60 font-medium'>
                  Done
                </button>
              </div>

              <div className='overflow-y-auto flex-1 px-4 space-y-5 pb-10'>
                {/* Team names */}
                <div className='flex gap-2'>
                  <div className='flex-1'>
                    <label className='text-[12px] text-gray-400 mb-1 block'>
                      Home team
                    </label>
                    <input
                      type='text'
                      value={homeTeamName}
                      onChange={(e) => setHomeTeamName(e.target.value)}
                      placeholder='Home team'
                      className='w-full px-3 py-2 rounded-lg text-[14px] bg-white/10 text-white placeholder-gray-500 border border-white/15 focus:outline-none'
                    />
                  </div>
                  <div className='flex-1'>
                    <label className='text-[12px] text-gray-400 mb-1 block'>
                      Away team
                    </label>
                    <input
                      type='text'
                      value={awayTeamName}
                      onChange={(e) => setAwayTeamName(e.target.value)}
                      placeholder='Away team'
                      className='w-full px-3 py-2 rounded-lg text-[14px] bg-white/10 text-white placeholder-gray-500 border border-white/15 focus:outline-none'
                    />
                  </div>
                </div>

                {/* Grid: team size, half duration, sub timer */}
                <div className='grid grid-cols-3 gap-2'>
                  {[
                    {
                      label: "Players on pitch",
                      el: (
                        <select
                          value={editTeamSize}
                          onChange={(e) =>
                            setEditTeamSize(Number(e.target.value))
                          }
                          className='w-full px-2 py-2 rounded-lg text-[14px] bg-white/10 text-white border border-white/15 focus:outline-none'>
                          {[4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                            <option key={n} value={n}>
                              {n}v{n}
                            </option>
                          ))}
                        </select>
                      ),
                    },
                    {
                      label: "Half (min)",
                      el: (
                        <input
                          type='number'
                          min={5}
                          max={90}
                          value={editHalfDuration}
                          onChange={(e) =>
                            setEditHalfDuration(
                              Math.max(1, Number(e.target.value) || 25),
                            )
                          }
                          className='w-full px-2 py-2 rounded-lg text-[14px] bg-white/10 text-white border border-white/15 focus:outline-none text-center'
                        />
                      ),
                    },
                    {
                      label: "Sub every (min)",
                      el: (
                        <input
                          type='number'
                          min={1}
                          max={30}
                          value={editTradeTimer}
                          onChange={(e) =>
                            setEditTradeTimer(
                              Math.min(
                                30,
                                Math.max(1, Number(e.target.value) || 10),
                              ),
                            )
                          }
                          className='w-full px-2 py-2 rounded-lg text-[14px] bg-white/10 text-white border border-white/15 focus:outline-none text-center'
                        />
                      ),
                    },
                  ].map(({ label, el }) => (
                    <div key={label}>
                      <label className='text-[11px] text-white/40 mb-1 block'>
                        {label}
                      </label>
                      {el}
                    </div>
                  ))}
                </div>

                {/* Sub suggestions consider */}
                <div>
                  <p className='text-[11px] font-semibold text-white/35 uppercase tracking-wider px-1 mb-2'>
                    Sub suggestions consider
                  </p>
                  <div className='rounded-xl overflow-hidden divide-y divide-white/8 bg-white/8'>
                    {(
                      [
                        {
                          id: "time",
                          label: "Time played",
                          desc: "Shortest time on pitch comes on first",
                          val: editConsiderTime,
                          set: setEditConsiderTime,
                        },
                        {
                          id: "pos",
                          label: "Position",
                          desc: "Prefer natural position matches",
                          val: editConsiderPosition,
                          set: setEditConsiderPosition,
                        },
                        {
                          id: "gk",
                          label: "Keeper history",
                          desc: "Former GK prioritised for non-defensive roles",
                          val: editConsiderKeeper,
                          set: setEditConsiderKeeper,
                        },
                        {
                          id: "suborder",
                          label: "Sub rotation order",
                          desc: "Last player subbed on is last to come off",
                          val: editConsiderSubOrder,
                          set: setEditConsiderSubOrder,
                        },
                      ] as {
                        id: string;
                        label: string;
                        desc: string;
                        val: boolean;
                        set: (v: boolean) => void;
                      }[]
                    ).map(({ id, label, desc, val, set }) => (
                      <label
                        key={id}
                        className='flex items-center justify-between px-4 py-3 cursor-pointer active:bg-white/5'>
                        <div className='flex-1 pr-3'>
                          <p className='text-[15px] text-white'>{label}</p>
                          <p className='text-[12px] text-white/40 mt-0.5'>
                            {desc}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "relative shrink-0 w-12.75 h-7.75 rounded-full transition-colors duration-200",
                            val ? "bg-ios-blue" : "bg-gray-600",
                          )}>
                          <div
                            className={cn(
                              "absolute top-0.5 left-0.5 w-6.75 h-6.75 rounded-full bg-white shadow-sm transition-transform duration-200",
                              val && "translate-x-5",
                            )}
                          />
                          <input
                            type='checkbox'
                            checked={val}
                            onChange={(e) => set(e.target.checked)}
                            className='sr-only'
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Alerts */}
                <div>
                  <p className='text-[11px] font-semibold text-white/35 uppercase tracking-wider px-1 mb-2'>
                    Alerts
                  </p>
                  <div className='rounded-xl overflow-hidden bg-white/8'>
                    <label className='flex items-center justify-between px-4 py-3 cursor-pointer active:bg-white/5'>
                      <div className='flex-1 pr-3'>
                        <p className='text-[15px] text-white'>
                          Sound alert on sub warning
                        </p>
                        <p className='text-[12px] text-white/40 mt-0.5'>
                          Beep 1 min before sub is due
                        </p>
                      </div>
                      <div
                        className={cn(
                          "relative shrink-0 w-12.75 h-7.75 rounded-full transition-colors duration-200",
                          editVibrate ? "bg-ios-blue" : "bg-gray-600",
                        )}>
                        <div
                          className={cn(
                            "absolute top-0.5 left-0.5 w-6.75 h-6.75 rounded-full bg-white shadow-sm transition-transform duration-200",
                            editVibrate && "translate-x-5",
                          )}
                        />
                        <input
                          type='checkbox'
                          checked={editVibrate}
                          onChange={(e) => setEditVibrate(e.target.checked)}
                          className='sr-only'
                        />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Players */}
                <div>
                  <p className='text-[11px] font-semibold text-white/35 uppercase tracking-wider px-1 mb-2'>
                    Players
                  </p>
                  {editPlayers.length > 0 && (
                    <div className='rounded-xl overflow-hidden divide-y divide-white/8 bg-white/8 mb-2'>
                      {editPlayers.map((player, i) => {
                        const isSwiped = editSwipedPlayerId === player.id;
                        return (
                          <div
                            key={player.id}
                            className='relative overflow-hidden'>
                            <div
                              className='absolute right-0 top-0 bottom-0 flex items-center'
                              style={{
                                transform: isSwiped
                                  ? "translateX(0)"
                                  : "translateX(100%)",
                                transition:
                                  "transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)",
                              }}>
                              <button
                                type='button'
                                onClick={() =>
                                  setEditPlayers(
                                    editPlayers.filter((_, idx) => idx !== i),
                                  )
                                }
                                className='h-full px-5 bg-red-500 text-white text-[14px] font-medium flex items-center'>
                                Delete
                              </button>
                            </div>
                            <div
                              onTouchStart={(e) => {
                                editTouchStartX.current = e.touches[0].clientX;
                              }}
                              onTouchMove={(e) => {
                                const diff =
                                  editTouchStartX.current -
                                  e.touches[0].clientX;
                                if (diff > 10) setEditSwipedPlayerId(player.id);
                                else if (diff < -30)
                                  setEditSwipedPlayerId(null);
                              }}
                              onClick={() => {
                                if (
                                  editSwipedPlayerId &&
                                  editSwipedPlayerId !== player.id
                                )
                                  setEditSwipedPlayerId(null);
                              }}
                              style={{
                                transform: isSwiped
                                  ? "translateX(-80px)"
                                  : "translateX(0)",
                                transition:
                                  "transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)",
                              }}
                              className='flex items-center gap-1.5 px-3 py-2 bg-transparent'>
                              <input
                                type='number'
                                min={0}
                                max={99}
                                value={player.number || ""}
                                placeholder='#'
                                onChange={(e) => {
                                  const u = [...editPlayers];
                                  u[i] = {
                                    ...u[i],
                                    number: parseInt(e.target.value) || 0,
                                  };
                                  setEditPlayers(u);
                                }}
                                className='w-11 px-1 py-1.5 rounded-md text-[13px] text-center font-semibold bg-white/10 text-white border border-white/15 focus:outline-none'
                              />
                              <input
                                type='text'
                                value={player.name}
                                placeholder='Player name'
                                onChange={(e) => {
                                  const u = [...editPlayers];
                                  u[i] = { ...u[i], name: e.target.value };
                                  setEditPlayers(u);
                                }}
                                className='flex-1 px-2 py-1.5 rounded-md text-[13px] bg-white/10 text-white border border-white/15 focus:outline-none'
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type='button'
                    onClick={() =>
                      setEditPlayers([
                        ...editPlayers,
                        {
                          id: crypto.randomUUID(),
                          name: "",
                          number: 0,
                          preferredPosition: "CM",
                        },
                      ])
                    }
                    className='w-full py-2.5 rounded-xl text-[14px] font-medium text-ios-blue border border-ios-blue/30 bg-ios-blue/10 active:opacity-70'>
                    + Add player
                  </button>
                </div>

                {/* Save button */}
                <button
                  type='button'
                  onClick={() => {
                    const updatedConfig: CoachConfig = {
                      ...config,
                      teamSize: editTeamSize,
                      halfDurationMinutes: editHalfDuration,
                      tradeTimerMinutes: editTradeTimer,
                      isHomeTeam: editIsHome,
                      subConsiderTime: editConsiderTime,
                      subConsiderPosition: editConsiderPosition,
                      subConsiderKeeper: editConsiderKeeper,
                      subConsiderSubOrder: editConsiderSubOrder,
                      vibrateOnWarning: editVibrate,
                      players: editPlayers,
                    };
                    // Sync lineup: keep existing entries, add new players as Bench, drop removed
                    const existingIds = new Set(lineup.map((l) => l.playerId));
                    const newEntries: CoachLineupEntry[] = editPlayers
                      .filter((p) => !existingIds.has(p.id))
                      .map((p) => ({
                        playerId: p.id,
                        position: "Bench" as FootballPosition,
                        onPitchSince: null,
                        totalMinutesPlayed: 0,
                      }));
                    const keepIds = new Set(editPlayers.map((p) => p.id));
                    const updatedLineup = [
                      ...lineup.filter((l) => keepIds.has(l.playerId)),
                      ...newEntries,
                    ];
                    setLineup(updatedLineup);
                    setLocalPlayers(editPlayers);
                    onUpdateConfig({ ...type, coachConfig: updatedConfig });
                    onSave(
                      buildCoachData({}, updatedLineup),
                      buildValue(currentHalf, isRunning, matchComplete),
                    );
                    setShowEditConfig(false);
                  }}
                  className='w-full py-3 rounded-xl text-[15px] font-semibold bg-ios-blue text-white active:opacity-80'>
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Statistics sheet ── */}
      {showGoals &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className='fixed inset-0 flex items-end'
            style={{ background: "rgba(0,0,0,0.65)", zIndex: 10000 }}
            onClick={() => setShowGoals(false)}>
            <div
              className='w-full rounded-t-2xl bg-[#111] overflow-hidden flex flex-col max-h-[88vh]'
              onClick={(e) => e.stopPropagation()}>
              {/* Drag handle */}
              <div className='flex justify-center pt-3 pb-1 shrink-0'>
                <div className='w-10 h-1 rounded-full bg-white/20' />
              </div>

              {/* ── Scoreboard ── */}
              {(() => {
                const ourGoals = goals.filter(
                  (g) => g.playerId !== "__away__",
                ).length;
                const theirGoals = goals.filter(
                  (g) => g.playerId === "__away__",
                ).length;
                const isHome = config.isHomeTeam !== false;
                const leftScore = isHome ? ourGoals : theirGoals;
                const rightScore = isHome ? theirGoals : ourGoals;
                const leftLabel = isHome
                  ? homeTeamName || "Home"
                  : awayTeamName || "Away";
                const rightLabel = isHome
                  ? awayTeamName || "Away"
                  : homeTeamName || "Home";
                return (
                  <div className='px-6 pt-3 pb-6 text-center shrink-0'>
                    <p className='text-[11px] uppercase tracking-widest text-white/30 font-semibold mb-4'>
                      {halfLabel}
                    </p>
                    <div className='flex items-center justify-center gap-1'>
                      <div className='flex-1 flex flex-col items-end gap-1.5'>
                        <span className='text-[11px] font-semibold tracking-widest text-white/40 uppercase'>
                          {leftLabel}
                        </span>
                      </div>
                      <div className='flex items-baseline gap-3 px-5'>
                        <span className='text-[64px] font-bold text-white tabular-nums leading-none'>
                          {leftScore}
                        </span>
                        <span className='text-[36px] text-white/25 font-light leading-none mb-1'>
                          –
                        </span>
                        <span className='text-[64px] font-bold text-white tabular-nums leading-none'>
                          {rightScore}
                        </span>
                      </div>
                      <div className='flex-1 flex flex-col items-start gap-1.5'>
                        <span className='text-[11px] font-semibold tracking-widest text-white/40 uppercase'>
                          {rightLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Goal events timeline ── */}
              {(() => {
                const isHome = config.isHomeTeam !== false;
                const sorted = [...goals].sort(
                  (a, b) => a.matchMinute - b.matchMinute,
                );
                if (sorted.length === 0) {
                  return (
                    <div className='px-6 pb-6 text-center shrink-0'>
                      <p className='text-[13px] text-white/25'>No goals yet</p>
                    </div>
                  );
                }
                return (
                  <div className='border-t border-white/8 shrink-0'>
                    {sorted.map((g) => {
                      const isOurGoal = g.playerId !== "__away__";
                      const player = isOurGoal
                        ? config.players.find((p) => p.id === g.playerId)
                        : null;
                      const name = player ? player.name : null;
                      // If we are home, our goals appear on the left
                      const goalOnLeft =
                        (isHome && isOurGoal) || (!isHome && !isOurGoal);
                      return (
                        <div
                          key={g.id}
                          className='flex items-center px-5 py-2.5 border-b border-white/5 last:border-0'>
                          {goalOnLeft ? (
                            <>
                              <span className='flex-1 text-[14px] font-medium text-white'>
                                {name ?? "—"}
                              </span>
                              <span className='text-[13px] text-white/40 tabular-nums ml-3'>
                                {g.matchMinute}&apos;
                              </span>
                              <span className='ml-2 text-[15px]'>⚽</span>
                              <span className='flex-1' />
                            </>
                          ) : (
                            <>
                              <span className='flex-1' />
                              <span className='mr-2 text-[15px]'>⚽</span>
                              <span className='text-[13px] text-white/40 tabular-nums mr-3'>
                                {g.matchMinute}&apos;
                              </span>
                              <span className='flex-1 text-[14px] font-medium text-white text-right'>
                                {name ?? "—"}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ── Add goal controls ── */}
              <div className='overflow-y-auto flex-1 border-t border-white/8'>
                <p className='px-5 pt-4 pb-1 text-[11px] uppercase tracking-widest text-white/30 font-semibold'>
                  Add Goal
                </p>
                {localPlayers.map((p) => {
                  const count = goals.filter((g) => g.playerId === p.id).length;
                  return (
                    <div
                      key={p.id}
                      className='flex items-center justify-between px-5 py-2.5 border-b border-white/5 last:border-0'>
                      <div className='flex items-center gap-3'>
                        <span className='text-[13px] text-white/35 w-5 text-right tabular-nums'>
                          {p.number}
                        </span>
                        <span className='text-[15px] text-white font-medium'>
                          {p.name}
                        </span>
                      </div>
                      <div className='flex items-center gap-3'>
                        <button
                          type='button'
                          onClick={() => handleRemoveGoal(p.id)}
                          disabled={count === 0}
                          className='w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-[20px] leading-none active:opacity-60 disabled:opacity-20'>
                          −
                        </button>
                        <span className='text-[15px] font-semibold text-white w-4 text-center tabular-nums'>
                          {count}
                        </span>
                        <button
                          type='button'
                          onClick={() => handleAddGoal(p.id)}
                          className='w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-[20px] leading-none active:opacity-60'>
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
                {/* Opponent */}
                <div className='flex items-center justify-between px-5 py-2.5'>
                  <span className='text-[15px] text-white/50 italic'>
                    {config.isHomeTeam !== false
                      ? awayTeamName || "Away team"
                      : homeTeamName || "Home team"}
                  </span>
                  <div className='flex items-center gap-3'>
                    <button
                      type='button'
                      onClick={() => handleRemoveGoal("__away__")}
                      disabled={
                        goals.filter((g) => g.playerId === "__away__")
                          .length === 0
                      }
                      className='w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-[20px] leading-none active:opacity-60 disabled:opacity-20'>
                      −
                    </button>
                    <span className='text-[15px] font-semibold text-white w-4 text-center tabular-nums'>
                      {goals.filter((g) => g.playerId === "__away__").length}
                    </span>
                    <button
                      type='button'
                      onClick={() => handleAddGoal("__away__")}
                      className='w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-[20px] leading-none active:opacity-60'>
                      +
                    </button>
                  </div>
                </div>
                {/* Safe-area spacer */}
                <div className='h-24' />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Half/Full time confirmation dialog ── */}
      {confirmAction !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className='fixed inset-0 flex items-center justify-center px-4'
            style={{ background: "rgba(0,0,0,0.55)", zIndex: 10000 }}
            onClick={() => setConfirmAction(null)}>
            <div
              className='w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 overflow-hidden'
              onClick={(e) => e.stopPropagation()}>
              <div className='px-5 pt-5 pb-4 text-center'>
                <p className='text-[16px] font-semibold text-gray-900 dark:text-white'>
                  {confirmAction === "halfTime"
                    ? "End 1st Half?"
                    : "End Match?"}
                </p>
                <p className='text-[13px] text-gray-500 mt-1'>
                  {confirmAction === "halfTime"
                    ? "The clock will stop and you'll move to half time."
                    : "The match will be marked as complete."}
                </p>
              </div>
              <div className='flex border-t border-gray-200 dark:border-gray-700'>
                <button
                  type='button'
                  onClick={() => setConfirmAction(null)}
                  className='flex-1 py-3.5 text-[15px] text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-800'>
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={() => {
                    if (confirmAction === "halfTime") handleHalfTime();
                    else handleEndMatch();
                    setConfirmAction(null);
                  }}
                  className={cn(
                    "flex-1 py-3.5 text-[15px] font-semibold active:bg-gray-100 dark:active:bg-gray-800",
                    confirmAction === "halfTime"
                      ? "text-amber-500"
                      : "text-red-500",
                  )}>
                  {confirmAction === "halfTime" ? "Half Time" : "Full Time"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Reset confirmation dialog ── */}
      {showResetConfirm &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className='fixed inset-0 flex items-center justify-center px-4'
            style={{ background: "rgba(0,0,0,0.55)", zIndex: 10000 }}
            onClick={() => setShowResetConfirm(false)}>
            <div
              className='w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 overflow-hidden'
              onClick={(e) => e.stopPropagation()}>
              <div className='px-5 pt-5 pb-4 text-center'>
                <p className='text-[16px] font-semibold text-gray-900 dark:text-white'>
                  Reset match?
                </p>
                <p className='text-[13px] text-gray-500 mt-1'>
                  The match clock, all player timers, substitutions and goals
                  will be cleared.
                </p>
              </div>
              <div className='flex border-t border-gray-200 dark:border-gray-700'>
                <button
                  type='button'
                  onClick={() => setShowResetConfirm(false)}
                  className='flex-1 py-3.5 text-[15px] text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-800'>
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={handleResetTimePlayed}
                  className='flex-1 py-3.5 text-[15px] font-semibold text-red-500 active:bg-gray-100 dark:active:bg-gray-800'>
                  Reset
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );

  if (expanded && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
