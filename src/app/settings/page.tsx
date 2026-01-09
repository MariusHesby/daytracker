"use client";

import { useRef, useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { ActivityTypeManager, ActivityTypeManagerRef } from "@/components";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { isLoading, syncToCloud, isSyncing } = useApp();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const {
    user,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    isLoading: authLoading,
  } = useAuth();
  const activityManagerRef = useRef<ActivityTypeManagerRef>(null);
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authMessageType, setAuthMessageType] = useState<"info" | "error">(
    "info"
  );
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Detect if app is running as standalone PWA and platform
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);
  }, []);

  const handleAuth = async () => {
    if (!email.trim()) {
      setAuthMessage(t("settings.enterEmail"));
      setAuthMessageType("error");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setAuthMessage(t("settings.passwordMin"));
      setAuthMessageType("error");
      return;
    }
    setAuthMessage(null);

    if (isSignUp) {
      const { error, needsConfirmation } = await signUpWithEmail(
        email,
        password
      );
      if (error) {
        setAuthMessage(error.message);
        setAuthMessageType("error");
      } else if (needsConfirmation) {
        setAuthMessage(t("settings.checkEmailConfirm"));
        setAuthMessageType("info");
      } else {
        setAuthMessage(t("settings.accountCreated"));
        setAuthMessageType("info");
      }
    } else {
      const { error } = await signInWithEmail(email, password);
      if (error) {
        // Make error messages more user-friendly
        if (error.message.includes("Invalid login credentials")) {
          setAuthMessage(t("settings.invalidCredentials"));
        } else {
          setAuthMessage(error.message);
        }
        setAuthMessageType("error");
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setAuthMessage(null);
  };

  const handleSyncData = async () => {
    setIsSyncingData(true);
    try {
      await syncToCloud();
      setAuthMessage(t("settings.syncComplete"));
    } catch {
      setAuthMessage(t("settings.syncFailed"));
    } finally {
      setIsSyncingData(false);
    }
  };

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='w-6 h-6 border-2 border-ios-blue border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  const themeOptions = [
    { value: "light", label: t("settings.light") },
    { value: "dark", label: t("settings.dark") },
    { value: "system", label: t("settings.system") },
  ] as const;

  return (
    <div className='pb-16'>
      {/* Main Content */}
      <main className='max-w-lg mx-auto px-4 pt-6 pb-4 space-y-6'>
        {/* Header */}
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
          Settings
        </h1>

        {/* Account Section */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            {t("settings.account")}
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            {user ? (
              <>
                <div className='px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-ios-blue flex items-center justify-center'>
                      <svg
                        className='w-5 h-5 text-white'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={2}
                        stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'
                        />
                      </svg>
                    </div>
                    <div>
                      <p className='text-[17px] text-gray-900 dark:text-white'>
                        {t("settings.loggedIn")}
                      </p>
                      <p className='text-[14px] text-gray-500'>{user.email}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={authLoading}
                  className='w-full px-4 py-3 min-h-[44px] text-[17px] text-ios-red text-center active:bg-gray-100 dark:active:bg-gray-700 disabled:opacity-50'>
                  {t("settings.signOut")}
                </button>
              </>
            ) : (
              <div className='p-4 space-y-3'>
                <p className='text-[15px] text-gray-500 dark:text-gray-400 text-center'>
                  {t("settings.signInDesc")}
                </p>
                <input
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("settings.emailPlaceholder")}
                  autoCapitalize='none'
                  autoCorrect='off'
                  className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-[17px] text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-ios-blue'
                />
                <div className='relative'>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("settings.passwordPlaceholder")}
                    className='w-full px-4 py-3 pr-12 bg-gray-100 dark:bg-gray-700 rounded-lg text-[17px] text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-ios-blue'
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500'>
                    {showPassword ? (
                      <svg
                        className='w-5 h-5'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={1.5}
                        stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88'
                        />
                      </svg>
                    ) : (
                      <svg
                        className='w-5 h-5'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={1.5}
                        stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z'
                        />
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                        />
                      </svg>
                    )}
                  </button>
                </div>
                <button
                  onClick={handleAuth}
                  disabled={authLoading}
                  className='w-full px-4 py-3 bg-ios-blue text-white rounded-lg text-[17px] font-medium active:opacity-80 disabled:opacity-50'>
                  {authLoading
                    ? t("settings.loading")
                    : isSignUp
                    ? t("settings.createAccount")
                    : t("settings.signIn")}
                </button>
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthMessage(null);
                  }}
                  className='w-full py-2 text-[15px] text-ios-blue'>
                  {isSignUp
                    ? t("settings.haveAccount")
                    : t("settings.noAccount")}
                </button>
              </div>
            )}
          </div>
          {authMessage && (
            <p
              className={cn(
                "text-[13px] px-4 mt-2",
                authMessageType === "error"
                  ? "text-ios-red"
                  : "text-gray-500 dark:text-gray-400"
              )}>
              {authMessage}
            </p>
          )}
          <p className='text-[13px] text-gray-500 dark:text-gray-400 px-4 mt-2'>
            {t("settings.cloudSyncDesc")}
          </p>
        </section>

        {/* Theme Section */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            {t("settings.theme")}
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            {themeOptions.map((option, index) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "w-full px-4 py-3 flex items-center justify-between min-h-[44px] text-left active:bg-gray-100 dark:active:bg-gray-700",
                  index < themeOptions.length - 1 &&
                    "border-b border-gray-200/80 dark:border-gray-700/80"
                )}>
                <span className='text-[17px] text-gray-900 dark:text-white'>
                  {option.label}
                </span>
                {theme === option.value && (
                  <svg
                    className='w-5 h-5 text-ios-blue'
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
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Add to Home Screen Section - only show if not already standalone */}
        {!isStandalone && (
          <section>
            <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
              Install App
            </h2>
            <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
              <div className='px-4 py-3 min-h-[44px]'>
                <div className='flex items-center gap-3 mb-2'>
                  <div className='w-10 h-10 bg-ios-blue rounded-xl flex items-center justify-center'>
                    <svg className='w-5 h-5 text-white' fill='none' viewBox='0 0 24 24' strokeWidth={2} stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M12 4.5v15m7.5-7.5h-15' />
                    </svg>
                  </div>
                  <div>
                    <span className='text-[17px] text-gray-900 dark:text-white font-medium'>
                      Add to Home Screen
                    </span>
                  </div>
                </div>
                {isIOS ? (
                  <div className='text-[15px] text-gray-500 dark:text-gray-400 space-y-2'>
                    <p>To install DayTracker on your iPhone:</p>
                    <ol className='list-decimal list-inside space-y-1 ml-1'>
                      <li>Tap the <span className='inline-flex items-center mx-1'>
                        <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor'>
                          <path strokeLinecap='round' strokeLinejoin='round' d='M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15' />
                        </svg>
                      </span> Share button</li>
                      <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                      <li>Tap <strong>Add</strong> in the top right</li>
                    </ol>
                  </div>
                ) : (
                  <div className='text-[15px] text-gray-500 dark:text-gray-400 space-y-2'>
                    <p>To install DayTracker:</p>
                    <ol className='list-decimal list-inside space-y-1 ml-1'>
                      <li>Tap the menu button (⋮) in your browser</li>
                      <li>Select <strong>Install app</strong> or <strong>Add to Home Screen</strong></li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Activity Types Section */}
        <section>
          <div className='flex items-center justify-between px-4 mb-2'>
            <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide'>
              {t("settings.activityTypes")}
            </h2>
            {!isAddingActivity && (
              <button
                onClick={() => activityManagerRef.current?.startAdding()}
                className='text-[13px] font-medium text-ios-blue'>
                + Add
              </button>
            )}
          </div>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            <ActivityTypeManager
              ref={activityManagerRef}
              onAddingChange={setIsAddingActivity}
            />
          </div>
        </section>

        {/* About Section */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            {t("settings.about")}
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl'>
            <div className='px-4 py-3 flex items-center justify-between min-h-[44px] border-b border-gray-200/80 dark:border-gray-700/80'>
              <span className='text-[17px] text-gray-900 dark:text-white'>
                {t("settings.app")}
              </span>
              <span className='text-[17px] text-gray-500'>DayTracker</span>
            </div>
            <div className='px-4 py-3 flex items-center justify-between min-h-[44px] border-b border-gray-200/80 dark:border-gray-700/80'>
              <span className='text-[17px] text-gray-900 dark:text-white'>
                {t("settings.version")}
              </span>
              <span className='text-[17px] text-gray-500'>1.0.0</span>
            </div>
            <div className='px-4 py-3 min-h-[44px]'>
              <span className='text-[17px] text-gray-900 dark:text-white'>
                {t("settings.dataStorage")}
              </span>
              <p className='text-[15px] text-gray-500 mt-1'>
                {t("settings.dataStorageDesc")}
              </p>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            {t("settings.data")}
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            <button
              onClick={() => {
                if (confirm(t("settings.deleteAllConfirm"))) {
                  indexedDB.deleteDatabase("daytracker-db");
                  window.location.reload();
                }
              }}
              className='w-full px-4 py-3 min-h-[44px] text-[17px] text-ios-red text-center active:bg-gray-100 dark:active:bg-gray-700'>
              {t("settings.deleteAllData")}
            </button>
          </div>
          <p className='text-[13px] text-gray-500 dark:text-gray-400 px-4 mt-2'>
            {t("settings.deleteAllDesc")}
          </p>
        </section>
      </main>
    </div>
  );
}
