"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function InfoModeOverlay() {
  const [active, setActive] = useState(false);
  const [infoText, setInfoText] = useState<string | null>(null);
  // Track all data-info texts that have already been shown this "session"
  const shownTexts = useRef<Set<string>>(new Set());

  useEffect(() => {
    const sync = () => setActive(localStorage.getItem("info_mode") === "true");
    sync();
    window.addEventListener("infoModeUpdated", sync);
    return () => window.removeEventListener("infoModeUpdated", sync);
  }, []);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!active) return;

      const target = e.target as HTMLElement;

      // Ignore clicks on the info banner button
      if (target.closest("[data-info-button]")) return;

      // Walk up the DOM tree to find the nearest data-info attribute
      let el: HTMLElement | null = target;
      let text: string | null = null;
      while (el) {
        if (el.getAttribute("data-info")) {
          text = el.getAttribute("data-info");
          break;
        }
        el = el.parentElement;
      }

      // Already shown info for this exact element — let click through
      if (text && shownTexts.current.has(text)) {
        setInfoText(null);
        return; // Don't block — action executes
      }

      // New data-info element — show info once and block this click
      if (text && el) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        shownTexts.current.add(text);
        setInfoText(text);
        return;
      }

      // Clicking something without data-info — dismiss popup
      setInfoText(null);
    },
    [active],
  );

  useEffect(() => {
    if (!active) {
      setInfoText(null);
      shownTexts.current.clear();
      return;
    }
    // Capture phase to intercept before React/Link handlers
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [active, handleClick]);

  if (!active || !infoText) return null;

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center px-8 pointer-events-none'>
      {/* Dimmed backdrop */}
      <div className='absolute inset-0 bg-black/40' />
      {/* iOS-style alert card */}
      <div
        className='relative w-full max-w-[270px] rounded-2xl overflow-hidden bg-white dark:bg-[#2c2c2e] shadow-2xl border-2 border-ios-blue'
        style={{ animation: "info-pop-in 0.18s ease-out" }}>
        <div className='px-5 py-5 text-center'>
          <p className='text-[15px] leading-[1.45] text-gray-800 dark:text-gray-100'>
            {infoText}
          </p>
        </div>
      </div>
    </div>
  );
}
