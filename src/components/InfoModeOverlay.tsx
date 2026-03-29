"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TooltipData {
  text: string;
  x: number;
  y: number;
}

export function InfoModeOverlay() {
  const [active, setActive] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

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

      // Never interfere with navigation (tab bar, links in nav)
      if (target.closest("nav")) return;

      // Ignore clicks on the info "i" button, popup modal, or toggle
      if (
        target.closest("[data-info-button]") ||
        target.closest("[data-info-popup]") ||
        target.closest("[data-info-toggle]")
      )
        return;

      // If clicking on the tooltip itself, dismiss it
      if (tooltipRef.current && tooltipRef.current.contains(target)) {
        setTooltip(null);
        return;
      }

      // Walk up the DOM tree to find the nearest data-info attribute
      let el: HTMLElement | null = target;
      let infoText: string | null = null;
      while (el) {
        if (el.getAttribute("data-info")) {
          infoText = el.getAttribute("data-info");
          break;
        }
        el = el.parentElement;
      }

      if (infoText) {
        const rect = el!.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const topY = rect.top;

        requestAnimationFrame(() => {
          setTooltip({ text: infoText, x: centerX, y: topY });
        });
      } else {
        requestAnimationFrame(() => {
          setTooltip(null);
        });
      }
    },
    [active],
  );

  useEffect(() => {
    if (!active) {
      setTooltip(null);
      return;
    }
    // Use bubble phase — let all native/React handlers fire first
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [active, handleClick]);

  // Adjust tooltip position to stay on screen
  const [adjustedPos, setAdjustedPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      setAdjustedPos(null);
      return;
    }
    const el = tooltipRef.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = tooltip.x - rect.width / 2;
    let y = tooltip.y - rect.height - 12;

    // Clamp horizontally
    if (x < 8) x = 8;
    if (x + rect.width > vw - 8) x = vw - 8 - rect.width;

    // If above would go off screen, show below
    if (y < 8) y = tooltip.y + 48;
    if (y + rect.height > vh - 8) y = vh - 8 - rect.height;

    setAdjustedPos({ x, y });
  }, [tooltip]);

  if (!active) return null;

  return (
    <>
      {tooltip && (
        <div
          ref={tooltipRef}
          className='fixed z-[9999] max-w-[280px] px-4 py-3 rounded-xl bg-gray-900/95 dark:bg-white/95 text-white dark:text-gray-900 text-[14px] leading-snug shadow-2xl'
          style={{
            left: adjustedPos ? adjustedPos.x : tooltip.x,
            top: adjustedPos ? adjustedPos.y : tooltip.y - 60,
            opacity: adjustedPos ? 1 : 0,
            transition: "opacity 0.15s ease",
          }}>
          {tooltip.text}
        </div>
      )}
    </>
  );
}
