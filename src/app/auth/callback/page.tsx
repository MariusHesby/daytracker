"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("Logging you in...");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragment from URL (Supabase puts tokens here)
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          // Set the session manually
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }

          setStatus("success");
          setMessage("Success! You can now return to the app.");

          // Try to close this window/tab and open the PWA
          // For iOS, we'll show instructions since we can't programmatically open the PWA
          setTimeout(() => {
            // Try to redirect to origin (this will work if opened in browser)
            window.location.href = window.location.origin + "/";
          }, 1500);
        } else {
          // Check if we already have a session (user might have refreshed)
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            setStatus("success");
            setMessage("Already logged in! Redirecting...");
            setTimeout(() => {
              window.location.href = window.location.origin + "/";
            }, 1000);
          } else {
            // No tokens found, might be an error or expired link
            setStatus("error");
            setMessage("Login link expired or invalid. Please try again.");
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    };

    handleAuthCallback();
  }, []);

  return (
    <div className='min-h-screen flex flex-col items-center justify-center p-6 bg-ios-gray-light dark:bg-ios-gray-dark'>
      <div className='bg-white dark:bg-ios-card-dark rounded-2xl p-8 max-w-sm w-full text-center shadow-lg'>
        {status === "loading" && (
          <>
            <div className='w-12 h-12 border-4 border-ios-blue border-t-transparent rounded-full animate-spin mx-auto mb-4' />
            <p className='text-[17px] text-gray-900 dark:text-white'>
              {message}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className='w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-8 h-8 text-green-600 dark:text-green-400'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={2.5}
                stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M4.5 12.75l6 6 9-13.5'
                />
              </svg>
            </div>
            <p className='text-[17px] text-gray-900 dark:text-white mb-4'>
              {message}
            </p>
            <div className='text-[15px] text-gray-500 dark:text-gray-400 space-y-2'>
              <p>If the app doesn&apos;t open automatically:</p>
              <p className='font-medium'>
                Open DayTracker from your home screen
              </p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className='w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-8 h-8 text-red-600 dark:text-red-400'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={2}
                stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </div>
            <p className='text-[17px] text-gray-900 dark:text-white mb-4'>
              {message}
            </p>
            <a
              href='/'
              className='inline-block px-6 py-3 bg-ios-blue text-white rounded-xl text-[17px] font-medium'>
              Go to App
            </a>
          </>
        )}
      </div>
    </div>
  );
}
