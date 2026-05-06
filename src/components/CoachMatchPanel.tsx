"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityType,
  LogEntry,
  CoachData,
  CoachLineupEntry,
  CoachSubstitution,
  CoachPlayer,
  CoachConfig,
  FootballPosition,
} from "@/types";
import { cn } from "@/lib/utils";

interface CoachMatchPanelProps {
  type: ActivityType;
  entry: LogEntry | null;
  onSave: (coachData: CoachData, value: string) => void;
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
): [string, string] | null {
  const validPitch = pitchEntries.filter((l) => l.position !== "GK");
  if (validPitch.length === 0 || benchEntries.length === 0) return null;

  const anyConsideration =
    subConsiderTime || subConsiderPosition || subConsiderKeeper;

  if (!anyConsideration || isFirstInHalf) {
    const pi = Math.floor(Math.random() * validPitch.length);
    const bi = Math.floor(Math.random() * benchEntries.length);
    return [validPitch[pi].playerId, benchEntries[bi].playerId];
  }

  const pitchScored = validPitch
    .map((l) => {
      let score = 0;
      if (subConsiderTime) score += getLineupMinutes(l, now, isRunning);
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
      <span
        className='text-white/80 text-[11px] tabular-nums leading-none'
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
        #{playerNumber}
      </span>
    </button>
  );
}

export function CoachMatchPanel({
  type,
  entry,
  onSave,
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
    } else {
      setLineup(
        config.players.map((p, i) => ({
          playerId: p.id,
          position:
            i < teamSize ? p.preferredPosition : ("Bench" as FootballPosition),
          onPitchSince: null,
          totalMinutesPlayed: 0,
        })),
      );
    }
  }, [entry, config, teamSize]);

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
  const timeSinceLastTrade =
    lastTradeTime && isRunning
      ? Math.floor((now - lastTradeTime) / 60000)
      : null;
  const tradeAlert =
    timeSinceLastTrade !== null &&
    timeSinceLastTrade >= config.tradeTimerMinutes;

  const pitchPlayers = lineup.filter((l) => l.position !== "Bench");
  const benchPlayers = lineup.filter((l) => l.position === "Bench");
  const matchComplete =
    !isRunning && matchStartTime !== null && currentHalf > 2;
  const matchNotStarted = matchStartTime === null;

  const getPlayer = (id: string) => config.players.find((p) => p.id === id);

  function getPlayerMinutes(l: CoachLineupEntry): number {
    const base = l.totalMinutesPlayed;
    if (l.onPitchSince && isRunning) {
      return base + Math.floor((now - l.onPitchSince) / 60000);
    }
    return base;
  }

  // ── suggestion trigger ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning || matchComplete || benchPlayers.length === 0) return;
    if (timeSinceLastTrade === null) return;
    const warningMinute = config.tradeTimerMinutes - 1;
    if (timeSinceLastTrade !== warningMinute) return;
    if (lastSuggestionTradeRef.current === lastTradeTime) return;

    lastSuggestionTradeRef.current = lastTradeTime;
    const isFirstInHalf = !halfFirstSuggestedRef.current.has(currentHalf);
    halfFirstSuggestedRef.current.add(currentHalf);

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

  function handleResetTimePlayed() {
    const t = Date.now();
    const nl = lineup.map((l) => ({
      ...l,
      totalMinutesPlayed: 0,
      onPitchSince: l.onPitchSince && isRunning ? t : l.onPitchSince,
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
    setNow(t);
    setLineup(nl);
    setShowResetConfirm(false);
    onSave(buildCoachData({}, nl), buildValue(currentHalf, isRunning, false));
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

  const pitchRows = getPitchRows(pitchPlayers);

  const halfLabel = matchComplete
    ? "Full Time"
    : matchNotStarted
      ? "Kick Off"
      : isRunning
        ? `${currentHalf === 1 ? "1st" : "2nd"} Half`
        : currentHalf === 2 && halfStartTime === null
          ? "Half Time"
          : "Paused";

  return (
    <div className='space-y-3 select-none'>
      <style>{`
        @keyframes playerSwitchFlash {
          0%   { transform: scale(1);    filter: brightness(1); }
          28%  { transform: scale(1.14); filter: brightness(1.65); }
          100% { transform: scale(1);    filter: brightness(1); }
        }
      `}</style>
      {/* ── Match clock ── */}
      <div className='rounded-2xl bg-gray-950 dark:bg-black/80 overflow-hidden'>
        <div className='flex items-center justify-between px-5 py-4'>
          <div>
            <p className='text-[11px] text-gray-400 uppercase tracking-widest font-semibold'>
              {halfLabel}
            </p>
            <p className='text-[40px] font-bold tabular-nums leading-none text-white mt-1'>
              {matchNotStarted ? "00:00" : fmtClock(halfElapsed)}
            </p>
          </div>

          {!matchNotStarted && (
            <div className='text-center px-2'>
              <p className='text-[11px] text-gray-400 uppercase tracking-widest'>
                Min
              </p>
              <p className='text-[34px] font-bold tabular-nums text-white leading-none mt-1'>
                {matchMinute}&apos;
              </p>
            </div>
          )}

          <div className='flex flex-col gap-1.5'>
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
                  <button
                    type='button'
                    onClick={handleHalfTime}
                    className='px-3 py-2 rounded-full text-[13px] font-semibold bg-amber-500 text-white active:opacity-80'>
                    Half Time
                  </button>
                  <button
                    type='button'
                    onClick={handlePause}
                    className='px-3 py-2 rounded-full text-[13px] font-semibold bg-gray-700 text-white active:opacity-80'>
                    Pause
                  </button>
                </>
              )}
            {!matchNotStarted &&
              !matchComplete &&
              isRunning &&
              currentHalf === 2 && (
                <>
                  <button
                    type='button'
                    onClick={handleEndMatch}
                    className='px-3 py-2 rounded-full text-[13px] font-semibold bg-red-500 text-white active:opacity-80'>
                    Full Time
                  </button>
                  <button
                    type='button'
                    onClick={handlePause}
                    className='px-3 py-2 rounded-full text-[13px] font-semibold bg-gray-700 text-white active:opacity-80'>
                    Pause
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

      {/* ── Trade alert ── */}
      {tradeAlert && (
        <div className='flex items-center gap-3 px-4 py-3 rounded-2xl bg-orange-500/15 border border-orange-500/30'>
          <span className='text-[22px] leading-none'>⚠️</span>
          <div>
            <p className='text-[13px] font-semibold text-orange-400'>
              Substitution overdue
            </p>
            <p className='text-[12px] text-orange-400/70'>
              {timeSinceLastTrade} min since last sub (goal: every{" "}
              {config.tradeTimerMinutes} min)
            </p>
          </div>
        </div>
      )}

      {/* ── Swap hint ── */}
      {selectedPlayerId && (
        <div className='px-4 py-2.5 rounded-2xl bg-amber-500/12 border border-amber-500/25 text-center'>
          <p className='text-[13px] font-medium text-amber-400'>
            Tap another player to switch positions or substitute
          </p>
          <button
            type='button'
            onClick={() => setSelectedPlayerId(null)}
            className='mt-1 text-[12px] text-amber-400/50'>
            cancel
          </button>
        </div>
      )}

      {/* ── Suggestion banner ── */}
      {suggestionPair && !selectedPlayerId && (
        <div className='rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 space-y-2'>
          <div className='flex items-center justify-between'>
            <p className='text-[12px] font-semibold text-cyan-400 uppercase tracking-wide'>
              💡 Suggested sub
            </p>
            <button
              type='button'
              onClick={() => {
                setSuggestionPair(null);
                setAltSuggestionPair(null);
              }}
              className='text-[11px] text-cyan-400/50'>
              dismiss
            </button>
          </div>
          <div className='flex items-center gap-3 flex-wrap'>
            {[
              suggestionPair,
              ...(altSuggestionPair ? [altSuggestionPair] : []),
            ].map((pair, pi) => {
              const offPlayer = config.players.find((p) => p.id === pair[0]);
              const onPlayer = config.players.find((p) => p.id === pair[1]);
              if (!offPlayer || !onPlayer) return null;
              return (
                <div
                  key={pi}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px]",
                    pi === 0
                      ? "bg-cyan-500/20 border border-cyan-400/40"
                      : "bg-white/5 border border-white/15",
                  )}>
                  <span className='text-red-400 font-medium'>
                    ↓ {offPlayer.name.split(" ")[0]}
                  </span>
                  <span className='text-white/30'>/</span>
                  <span className='text-green-400 font-medium'>
                    ↑ {onPlayer.name.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
          {/* Centre circle */}
          <ellipse
            cx='50'
            cy='75'
            rx='13'
            ry='9'
            fill='none'
            stroke='white'
            strokeWidth='0.6'
          />
          <circle cx='50' cy='75' r='1.4' fill='white' />
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

        {/* Players */}
        <div className='relative z-10 flex flex-col justify-between gap-2 py-5 px-3 min-h-96'>
          {pitchRows.map((row, rowIdx) => (
            <div key={rowIdx} className='flex justify-around'>
              {row.map((l) => {
                const p = getPlayer(l.playerId);
                if (!p) return null;
                return (
                  <PlayerCard
                    key={l.playerId}
                    lineupEntry={l}
                    playerName={p.name}
                    playerNumber={p.number}
                    minutes={getPlayerMinutes(l)}
                    isSelected={selectedPlayerId === l.playerId}
                    isTarget={
                      !!selectedPlayerId && selectedPlayerId !== l.playerId
                    }
                    switchRank={getSwitchRank(l.playerId)}
                    switchedAt={recentSwitches[l.playerId] ?? null}
                    isSuggested={
                      !!suggestionPair && suggestionPair[0] === l.playerId
                    }
                    onTap={(e) => handlePlayerTap(l.playerId, e)}
                  />
                );
              })}
            </div>
          ))}
          {pitchRows.length === 0 && (
            <div className='flex-1 flex items-center justify-center'>
              <p className='text-white/30 text-[14px]'>No players on pitch</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bench ── */}
      {benchPlayers.length > 0 &&
        (() => {
          // Sort: most recently switched → leftmost (will wait longest)
          // Oldest switch / never switched → rightmost (next up, biggest circle)
          const sortedBench = [...benchPlayers].sort((a, b) => {
            const ta = recentSwitches[a.playerId] ?? 0;
            const tb = recentSwitches[b.playerId] ?? 0;
            return tb - ta; // newest first (leftmost)
          });
          const n = sortedBench.length;
          return (
            <div>
              <p className='text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest px-1 mb-2'>
                Bench ({n})
              </p>
              <div
                className='rounded-2xl px-3 py-3'
                style={{ background: "rgba(12, 16, 25, 0.8)" }}
                onClick={() => setSelectedPlayerId(null)}>
                <div className='flex gap-2 justify-start'>
                  {sortedBench.map((l, i) => {
                    const p = getPlayer(l.playerId);
                    if (!p) return null;
                    const circleScale = n === 1 ? 0.5 : i / (n - 1);
                    const isNextUp = i === n - 1;
                    return (
                      <PlayerCard
                        key={l.playerId}
                        lineupEntry={l}
                        playerName={p.name}
                        playerNumber={p.number}
                        minutes={getPlayerMinutes(l)}
                        isSelected={selectedPlayerId === l.playerId}
                        isTarget={
                          !!selectedPlayerId && selectedPlayerId !== l.playerId
                        }
                        switchRank={getSwitchRank(l.playerId)}
                        switchedAt={recentSwitches[l.playerId] ?? null}
                        isSuggested={
                          !!suggestionPair && suggestionPair[1] === l.playerId
                        }
                        isBench={true}
                        circleScale={circleScale}
                        isNextUp={isNextUp}
                        onTap={(e) => handlePlayerTap(l.playerId, e)}
                      />
                    );
                  })}
                </div>
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
                      ↓ {off ? `#${off.number} ${off.name}` : "?"}
                    </span>
                    <span className='text-gray-500'>→</span>
                    <span className='text-green-400 font-semibold'>
                      ↑ {on ? `#${on.number} ${on.name}` : "?"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Reset time played + Regret ── */}
      <div className='flex justify-between items-center'>
        <button
          type='button'
          onClick={handleRegret}
          disabled={undoStack.length === 0}
          className='text-[12px] text-orange-400 dark:text-orange-400 active:opacity-60 disabled:opacity-30 disabled:pointer-events-none'>
          ↩ Regret
        </button>
        <button
          type='button'
          onClick={() => setShowResetConfirm(true)}
          className='text-[12px] text-gray-500 dark:text-gray-500 active:opacity-60'>
          Reset time played
        </button>
      </div>

      {/* ── Reset confirmation dialog ── */}
      {showResetConfirm && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center px-4'
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setShowResetConfirm(false)}>
          <div
            className='w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 overflow-hidden'
            onClick={(e) => e.stopPropagation()}>
            <div className='px-5 pt-5 pb-4 text-center'>
              <p className='text-[16px] font-semibold text-gray-900 dark:text-white'>
                Reset time played?
              </p>
              <p className='text-[13px] text-gray-500 mt-1'>
                All player minutes will be set back to zero.
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
        </div>
      )}
    </div>
  );
}
