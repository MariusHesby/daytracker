"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { submitFeedback } from "@/lib/feedback";

const PAGE_LABELS: Record<string, string> = {
  "/": "Today",
  "/movies-tv": "Movies & TV",
  "/stats": "Statistics",
  "/friends": "Friends",
  "/settings": "Settings",
  "/workout": "Workout",
  "/admin": "Admin",
};

export function FeedbackBar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const check = () => {
      setVisible(
        typeof window !== "undefined" &&
          localStorage.getItem("feedback_mode") === "true",
      );
    };
    check();
    window.addEventListener("feedbackModeUpdated", check);
    return () => window.removeEventListener("feedbackModeUpdated", check);
  }, []);

  // Reset on page change
  useEffect(() => {
    setMessage("");
    setStatus("idle");
  }, [pathname]);

  if (!visible || !user) return null;

  const pageLabel = PAGE_LABELS[pathname] ?? pathname;
  const remaining = 150 - message.length;

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed || status === "sending") return;
    setStatus("sending");
    try {
      await submitFeedback(user.id, pageLabel, trimmed);
      setMessage("");
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <div className='fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 pointer-events-none'>
      <div className='pointer-events-auto bg-white dark:bg-gray-900 border-2 border-ios-blue rounded-2xl shadow-2xl overflow-hidden'>
        {/* Header strip */}
        <div className='flex items-center justify-between bg-ios-blue px-3 py-1.5'>
          <span className='text-[11px] font-bold text-white uppercase tracking-wide'>
            Feedback · {pageLabel}
          </span>
          {remaining <= 30 && status === "idle" && (
            <span
              className={`text-[11px] font-semibold ${remaining <= 10 ? "text-red-200" : "text-blue-100"}`}>
              {remaining}
            </span>
          )}
        </div>

        {/* Input row */}
        <div className='flex gap-2 items-center px-3 py-2.5'>
          <input
            ref={inputRef}
            type='text'
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 150))}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder='Report a bug or suggest a change…'
            className='flex-1 bg-gray-100 dark:bg-gray-800 text-[14px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl px-3 py-2 outline-none border-none min-w-0'
            disabled={status === "sending" || status === "sent"}
          />
          <button
            onClick={handleSubmit}
            disabled={
              !message.trim() || status === "sending" || status === "sent"
            }
            className='shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold bg-ios-blue text-white active:opacity-80 disabled:opacity-40 transition-opacity'>
            {status === "sending"
              ? "…"
              : status === "sent"
                ? "✓"
                : status === "error"
                  ? "Retry"
                  : "Send"}
          </button>
        </div>

        {status === "sent" && (
          <p className='text-[11px] text-ios-green pb-2 text-center'>
            Thanks for your feedback!
          </p>
        )}
        {status === "error" && (
          <p className='text-[11px] text-ios-red pb-2 text-center'>
            Failed to send — please try again.
          </p>
        )}
      </div>
    </div>
  );
}
