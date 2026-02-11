"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<
    "loading" | "success" | "error" | "reset-password"
  >("loading");
  const [message, setMessage] = useState("Logging you in...");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragment from URL (Supabase puts tokens here)
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1),
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (accessToken && refreshToken) {
          // Set the session manually
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw new Error(error.message || "Failed to set session");
          }

          // Check if this is a password recovery flow
          if (type === "recovery") {
            setStatus("reset-password");
            setMessage("Enter your new password");
            return;
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

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setMessage(error.message);
        setIsUpdating(false);
        return;
      }

      setStatus("success");
      setMessage("Password updated successfully!");
      // Don't auto-redirect, show instructions instead
    } catch (err) {
      console.error("Password update error:", err);
      setMessage("Failed to update password. Please try again.");
      setIsUpdating(false);
    }
  };

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
            <p className='text-[17px] text-gray-900 dark:text-white mb-2'>
              {message}
            </p>
            <div className='text-[15px] text-gray-500 dark:text-gray-400 space-y-3 mb-4'>
              <p>Your password has been updated.</p>
              <p className='font-medium'>
                Return to DayTracker from your home screen to continue.
              </p>
            </div>
            <p className='text-[13px] text-gray-400 dark:text-gray-500'>
              You can close this browser tab.
            </p>
          </>
        )}

        {status === "reset-password" && (
          <>
            <div className='w-16 h-16 bg-ios-blue/10 rounded-full flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-8 h-8 text-ios-blue'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={2}
                stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z'
                />
              </svg>
            </div>
            <h2 className='text-[20px] font-semibold text-gray-900 dark:text-white mb-2'>
              Reset Password
            </h2>
            <p className='text-[15px] text-gray-500 dark:text-gray-400 mb-4'>
              {message}
            </p>
            <div className='space-y-3'>
              <input
                type='password'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder='New password (min 6 characters)'
                className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-[17px] text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-ios-blue'
              />
              <input
                type='password'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder='Confirm new password'
                className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-[17px] text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-ios-blue'
              />
              <button
                onClick={handleUpdatePassword}
                disabled={isUpdating || !newPassword || !confirmPassword}
                className='w-full px-6 py-3 bg-ios-blue text-white rounded-xl text-[17px] font-medium disabled:opacity-50'>
                {isUpdating ? "Updating..." : "Update Password"}
              </button>
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
            <Link
              href='/'
              className='inline-block px-6 py-3 bg-ios-blue text-white rounded-xl text-[17px] font-medium'>
              Go to App
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
