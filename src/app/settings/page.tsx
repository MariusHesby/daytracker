"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import {
  ActivityTypeManager,
  ActivityTypeManagerRef,
  Avatar,
  EditProfileModal,
} from "@/components";
import { cn } from "@/lib/utils";
import {
  FunFactCategory,
  CATEGORY_LABELS,
  getSelectedCategories,
  setSelectedCategories,
  fetchFactByCategory,
  fetchRandomFunFact,
  FunFact,
} from "@/lib/funfacts";
import {
  getStoredLocation,
  setStoredLocation,
  clearStoredLocation,
  searchLocation,
  GeocodingResult,
  StoredLocation,
} from "@/lib/weather";

export default function SettingsPage() {
  const {
    isLoading,
    syncToCloud,
    isSyncing,
    allActivityTypes,
    updateActivityType,
  } = useApp();
  const { theme, setTheme } = useTheme();
  const {
    user,
    profile,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut,
    deleteAccount,
    deleteAllData,
    isLoading: authLoading,
  } = useAuth();
  const activityManagerRef = useRef<ActivityTypeManagerRef>(null);
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authMessageType, setAuthMessageType] = useState<"info" | "error">(
    "info",
  );
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showDeleteAllDataModal, setShowDeleteAllDataModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [colorScheme, setColorScheme] = useState<1 | 2 | 3>(1);
  const [nutritionMergeExpanded, setNutritionMergeExpanded] = useState(false);

  // Location/Weather state
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [storedLocation, setStoredLocationState] =
    useState<StoredLocation | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState<GeocodingResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  // Load stored location on mount
  useEffect(() => {
    setStoredLocationState(getStoredLocation());
  }, []);

  // Debounced location search
  const searchLocationDebounced = useCallback(async (query: string) => {
    if (query.length < 2) {
      setLocationResults([]);
      return;
    }
    setIsSearchingLocation(true);
    const results = await searchLocation(query);
    setLocationResults(results);
    setIsSearchingLocation(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchLocationDebounced(locationSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [locationSearch, searchLocationDebounced]);

  const handleSelectLocation = (result: GeocodingResult) => {
    const location: StoredLocation = {
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.admin1
        ? `${result.name}, ${result.admin1}`
        : `${result.name}, ${result.country}`,
    };
    setStoredLocation(location);
    setStoredLocationState(location);
    setLocationSearch("");
    setLocationResults([]);
    // Dispatch event to update weather on home page
    window.dispatchEvent(new Event("locationUpdated"));
  };

  const handleClearLocation = () => {
    clearStoredLocation();
    setStoredLocationState(null);
    window.dispatchEvent(new Event("locationUpdated"));
  };

  // Fun Facts categories state
  const [funFactCategories, setFunFactCategories] = useState<FunFactCategory[]>(
    [],
  );
  const [funFactsExpanded, setFunFactsExpanded] = useState(false);
  const [testFunFact, setTestFunFact] = useState<FunFact | null>(null);
  const [showTestFunFact, setShowTestFunFact] = useState(false);
  const [loadingTestCategory, setLoadingTestCategory] =
    useState<FunFactCategory | null>(null);
  const [showTestAnswer, setShowTestAnswer] = useState(false);
  const [testSelectedAnswer, setTestSelectedAnswer] = useState<string | null>(
    null,
  );
  const [showTestAnswerAnimation, setShowTestAnswerAnimation] = useState<
    "correct" | "wrong" | null
  >(null);

  // Test a fun fact category
  const testFunFactCategory = async (category: FunFactCategory) => {
    setLoadingTestCategory(category);
    try {
      const fact = await fetchFactByCategory(category);
      setTestFunFact(fact);
      setShowTestFunFact(true);
      setShowTestAnswer(false);
      setTestSelectedAnswer(null);
    } catch (error) {
      console.error("Error fetching test fun fact:", error);
    } finally {
      setLoadingTestCategory(null);
    }
  };

  // Load fun fact categories on mount
  useEffect(() => {
    setFunFactCategories(getSelectedCategories());
  }, []);

  // Toggle a fun fact category
  const toggleFunFactCategory = (category: FunFactCategory) => {
    const newCategories = funFactCategories.includes(category)
      ? funFactCategories.filter((c) => c !== category)
      : [...funFactCategories, category];

    setFunFactCategories(newCategories);
    setSelectedCategories(newCategories);
  };

  // Default color palettes based on the gradient images
  const defaultPalettes = {
    // Palette 1: Tan/Orange/White theme
    slot1: {
      color1: "#c7a06a", // Tan/Brown
      color2: "#ffffff", // White
      color3: "#ff9500", // Orange
      color4: "#ffffff", // White
      color5: "#ffffff", // White
    },
    // Palette 2: Pink/Magenta/Purple theme
    slot2: {
      color1: "#ff00ff", // Magenta
      color2: "#ff69b4", // Hot Pink
      color3: "#ffffff", // White
      color4: "#ffffff", // White
      color5: "#800080", // Purple
    },
    // Palette 3: Blue theme
    slot3: {
      color1: "#007aff", // iOS Blue
      color2: "#0a84ff", // Blue
      color3: "#007aff", // Blue
      color4: "#ffffff", // White
      color5: "#0055cc", // Dark Blue
    },
  };

  // Current colors for each slot (can be customized)
  const [slot1Colors, setSlot1Colors] = useState(defaultPalettes.slot1);
  const [slot2Colors, setSlot2Colors] = useState(defaultPalettes.slot2);
  const [slot3Colors, setSlot3Colors] = useState(defaultPalettes.slot3);

  // Load color scheme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("colorScheme");
    if (saved && ["1", "2", "3"].includes(saved)) {
      setColorScheme(parseInt(saved) as 1 | 2 | 3);
    }
    // Load saved slot colors
    const savedSlot1 = localStorage.getItem("colorSlot1");
    if (savedSlot1) {
      try {
        setSlot1Colors(JSON.parse(savedSlot1));
      } catch {
        // Invalid JSON, use defaults
      }
    }
    const savedSlot2 = localStorage.getItem("colorSlot2");
    if (savedSlot2) {
      try {
        setSlot2Colors(JSON.parse(savedSlot2));
      } catch {
        // Invalid JSON
      }
    }
    const savedSlot3 = localStorage.getItem("colorSlot3");
    if (savedSlot3) {
      try {
        setSlot3Colors(JSON.parse(savedSlot3));
      } catch {
        // Invalid JSON
      }
    }
  }, []);

  // Get current colors for the active scheme
  const getCurrentColors = () => {
    switch (colorScheme) {
      case 1:
        return slot1Colors;
      case 2:
        return slot2Colors;
      case 3:
        return slot3Colors;
    }
  };

  // Save color scheme and apply to document
  const handleColorSchemeChange = (scheme: 1 | 2 | 3) => {
    setColorScheme(scheme);
    localStorage.setItem("colorScheme", String(scheme));
    // Update the document class for the color scheme
    document.documentElement.classList.remove(
      "colorful-1",
      "colorful-2",
      "colorful-3",
    );
    document.documentElement.classList.add(`colorful-${scheme}`);

    // Apply colors for the selected scheme
    const colors =
      scheme === 1 ? slot1Colors : scheme === 2 ? slot2Colors : slot3Colors;
    applyCustomColors(colors);
  };

  // Apply custom colors to CSS variables
  const applyCustomColors = (colors: typeof slot1Colors) => {
    const root = document.documentElement;
    root.style.setProperty("--custom-color-1", colors.color1);
    root.style.setProperty("--custom-color-2", colors.color2);
    root.style.setProperty("--custom-color-3", colors.color3);
    root.style.setProperty("--custom-color-4", colors.color4);
    root.style.setProperty("--custom-color-5", colors.color5);
  };

  // Handle color change for the current scheme
  const handleColorChange = (
    colorKey: keyof typeof slot1Colors,
    value: string,
  ) => {
    const updateColors = (prev: typeof slot1Colors) => ({
      ...prev,
      [colorKey]: value,
    });

    if (colorScheme === 1) {
      const newColors = updateColors(slot1Colors);
      setSlot1Colors(newColors);
      localStorage.setItem("colorSlot1", JSON.stringify(newColors));
      applyCustomColors(newColors);
    } else if (colorScheme === 2) {
      const newColors = updateColors(slot2Colors);
      setSlot2Colors(newColors);
      localStorage.setItem("colorSlot2", JSON.stringify(newColors));
      applyCustomColors(newColors);
    } else {
      const newColors = updateColors(slot3Colors);
      setSlot3Colors(newColors);
      localStorage.setItem("colorSlot3", JSON.stringify(newColors));
      applyCustomColors(newColors);
    }
  };

  // Reset current scheme to defaults
  const resetCurrentScheme = () => {
    if (colorScheme === 1) {
      setSlot1Colors(defaultPalettes.slot1);
      localStorage.removeItem("colorSlot1");
      applyCustomColors(defaultPalettes.slot1);
    } else if (colorScheme === 2) {
      setSlot2Colors(defaultPalettes.slot2);
      localStorage.removeItem("colorSlot2");
      applyCustomColors(defaultPalettes.slot2);
    } else {
      setSlot3Colors(defaultPalettes.slot3);
      localStorage.removeItem("colorSlot3");
      applyCustomColors(defaultPalettes.slot3);
    }
  };

  // Apply saved color scheme on mount when colorful theme is active
  useEffect(() => {
    if (theme === "colorful") {
      document.documentElement.classList.remove(
        "colorful-1",
        "colorful-2",
        "colorful-3",
      );
      document.documentElement.classList.add(`colorful-${colorScheme}`);
      // Apply colors for the current scheme
      const colors =
        colorScheme === 1
          ? slot1Colors
          : colorScheme === 2
            ? slot2Colors
            : slot3Colors;
      applyCustomColors(colors);
    } else {
      document.documentElement.classList.remove(
        "colorful-1",
        "colorful-2",
        "colorful-3",
      );
    }
  }, [theme, colorScheme, slot1Colors, slot2Colors, slot3Colors]);

  // Detect if app is running as standalone PWA and platform
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    setIsStandalone(standalone);

    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);
  }, []);

  const handleAuth = async () => {
    if (!email.trim()) {
      setAuthMessage("Please enter your email");
      setAuthMessageType("error");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setAuthMessage("Password must be at least 6 characters");
      setAuthMessageType("error");
      return;
    }
    setAuthMessage(null);

    if (isSignUp) {
      const { error, needsConfirmation } = await signUpWithEmail(
        email,
        password,
      );
      if (error) {
        setAuthMessage(error.message);
        setAuthMessageType("error");
      } else if (needsConfirmation) {
        setAuthMessage(
          "Check your email to confirm your account, then sign in.",
        );
        setAuthMessageType("info");
      } else {
        setAuthMessage("Account created! You are now logged in.");
        setAuthMessageType("info");
      }
    } else {
      const { error } = await signInWithEmail(email, password);
      if (error) {
        // Make error messages more user-friendly
        if (error.message.includes("Invalid login credentials")) {
          setAuthMessage("Invalid email or password. Please try again.");
        } else {
          setAuthMessage(error.message);
        }
        setAuthMessageType("error");
      }
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setAuthMessage("Please enter your email");
      setAuthMessageType("error");
      return;
    }
    setAuthMessage(null);
    setResetLinkSent(false);

    const { error } = await resetPassword(email.trim());
    if (error) {
      setAuthMessage(error.message);
      setAuthMessageType("error");
    } else {
      setResetLinkSent(true);
      setAuthMessage(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setAuthMessage(null);
      // Reload settings page to show logged out state
      setTimeout(() => {
        window.location.href = "/settings";
      }, 100);
    } catch (error) {
      console.error("Sign out error:", error);
      // Force reload anyway
      setTimeout(() => {
        window.location.href = "/settings";
      }, 100);
    }
  };

  const handleSyncData = async () => {
    setIsSyncingData(true);
    try {
      await syncToCloud();
      setAuthMessage("Data synced successfully!");
    } catch {
      setAuthMessage("Sync failed. Please try again.");
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
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "colorful", label: "Colorful" },
    { value: "system", label: "System" },
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
            Account
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            {user ? (
              <>
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className='w-full px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80 active:bg-gray-100 dark:active:bg-gray-700'>
                  <div className='flex items-center gap-3'>
                    <Avatar avatar={profile?.avatar || null} size='md' />
                    <div className='flex-1 text-left'>
                      <p className='text-[17px] text-gray-900 dark:text-white'>
                        {profile?.fullName || "Logged in"}
                      </p>
                      <p className='text-[14px] text-gray-500'>{user.email}</p>
                    </div>
                    <svg
                      className='w-5 h-5 text-gray-400'
                      fill='none'
                      viewBox='0 0 24 24'
                      strokeWidth={2}
                      stroke='currentColor'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M8.25 4.5l7.5 7.5-7.5 7.5'
                      />
                    </svg>
                  </div>
                </button>
                <button
                  onClick={handleSignOut}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleSignOut();
                  }}
                  disabled={authLoading}
                  className='w-full px-4 py-3 min-h-[44px] text-[17px] text-ios-red text-center active:bg-gray-100 dark:active:bg-gray-700 disabled:opacity-50 cursor-pointer'>
                  Sign Out
                </button>
              </>
            ) : (
              <div className='p-4 space-y-3'>
                <p className='text-[15px] text-gray-500 dark:text-gray-400 text-center'>
                  {isResetPassword
                    ? "Enter your email to receive a password reset link."
                    : "Sign in to sync your data across devices"}
                </p>
                <input
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='Enter your email'
                  autoCapitalize='none'
                  autoCorrect='off'
                  className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-[17px] text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-ios-blue'
                />
                {!isResetPassword && (
                  <div className='relative'>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder='Enter password (min 6 characters)'
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
                )}
                {isResetPassword ? (
                  <>
                    <button
                      onClick={handleResetPassword}
                      disabled={authLoading || resetLinkSent}
                      className={cn(
                        "w-full px-4 py-3 text-white rounded-lg text-[17px] font-medium active:opacity-80 disabled:opacity-50 transition-colors",
                        resetLinkSent ? "bg-green-600" : "bg-ios-blue",
                      )}>
                      {authLoading
                        ? "Loading..."
                        : resetLinkSent
                          ? "Link sent to your e-mail"
                          : "Send Reset Link"}
                    </button>
                    <button
                      onClick={() => {
                        setIsResetPassword(false);
                        setResetLinkSent(false);
                        setAuthMessage(null);
                      }}
                      className='w-full py-2 text-[15px] text-ios-blue'>
                      Back to Sign In
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleAuth}
                      disabled={authLoading}
                      className='w-full px-4 py-3 bg-ios-blue text-white rounded-full text-[15px] font-medium shadow-lg shadow-ios-blue/30 active:opacity-80 disabled:opacity-50'>
                      {authLoading
                        ? "Loading..."
                        : isSignUp
                          ? "Create Account"
                          : "Sign In"}
                    </button>
                    {!isSignUp && (
                      <button
                        onClick={() => {
                          setIsResetPassword(true);
                          setAuthMessage(null);
                        }}
                        className='w-full py-1 text-[14px] text-gray-500'>
                        Forgot password?
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setAuthMessage(null);
                      }}
                      className='w-full py-2 text-[15px] text-ios-blue'>
                      {isSignUp
                        ? "Already have an account? Sign in"
                        : "Don't have an account? Create one"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {authMessage && (
            <p
              className={cn(
                "text-[13px] px-4 mt-2",
                authMessageType === "error"
                  ? "text-ios-red"
                  : "text-gray-500 dark:text-gray-400",
              )}>
              {authMessage}
            </p>
          )}
          <p className='text-[13px] text-gray-500 dark:text-gray-400 px-4 mt-2'>
            Sign in to keep your data safe in the cloud and sync across devices.
          </p>
        </section>

        {/* Theme Section */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            Theme
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            {themeOptions.map((option, index) => (
              <div key={option.value}>
                <button
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "w-full px-4 py-3 flex items-center justify-between min-h-[44px] text-left active:bg-gray-100 dark:active:bg-gray-700",
                    index < themeOptions.length - 1 &&
                      !(option.value === "colorful" && theme === "colorful") &&
                      "border-b border-gray-200/80 dark:border-gray-700/80",
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
                {/* Color scheme circles - only show when colorful is selected */}
                {option.value === "colorful" && theme === "colorful" && (
                  <>
                    <div className='px-4 py-3 flex items-center gap-4 border-b border-gray-200/80 dark:border-gray-700/80'>
                      <span className='text-[14px] text-gray-500 dark:text-gray-400'>
                        Palette:
                      </span>
                      <div className='flex items-center gap-3'>
                        {/* Scheme 1 - Pink/Orange */}
                        <button
                          onClick={() => handleColorSchemeChange(1)}
                          className={cn(
                            "w-8 h-8 rounded-full relative overflow-hidden transition-transform",
                            colorScheme === 1 &&
                              "ring-2 ring-ios-blue ring-offset-2 scale-110",
                          )}
                          style={{
                            background: `conic-gradient(from 0deg, ${slot1Colors.color1}, ${slot1Colors.color2}, ${slot1Colors.color4}, ${slot1Colors.color3}, ${slot1Colors.color1})`,
                          }}
                          aria-label='Color scheme 1 (Pink/Orange)'
                        />
                        {/* Scheme 2 - Blue/Purple */}
                        <button
                          onClick={() => handleColorSchemeChange(2)}
                          className={cn(
                            "w-8 h-8 rounded-full relative overflow-hidden transition-transform",
                            colorScheme === 2 &&
                              "ring-2 ring-ios-blue ring-offset-2 scale-110",
                          )}
                          style={{
                            background: `conic-gradient(from 0deg, ${slot2Colors.color1}, ${slot2Colors.color2}, ${slot2Colors.color4}, ${slot2Colors.color3}, ${slot2Colors.color1})`,
                          }}
                          aria-label='Color scheme 2 (Blue/Purple)'
                        />
                        {/* Scheme 3 - Green/Teal */}
                        <button
                          onClick={() => handleColorSchemeChange(3)}
                          className={cn(
                            "w-8 h-8 rounded-full relative overflow-hidden transition-transform",
                            colorScheme === 3 &&
                              "ring-2 ring-ios-blue ring-offset-2 scale-110",
                          )}
                          style={{
                            background: `conic-gradient(from 0deg, ${slot3Colors.color1}, ${slot3Colors.color2}, ${slot3Colors.color4}, ${slot3Colors.color3}, ${slot3Colors.color1})`,
                          }}
                          aria-label='Color scheme 3 (Green/Teal)'
                        />
                      </div>
                    </div>
                    {/* Color pickers - always show when colorful theme is selected */}
                    <div className='px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80'>
                      <p className='text-[13px] text-gray-500 dark:text-gray-400 mb-3'>
                        Customize palette {colorScheme}:
                      </p>
                      <div className='grid grid-cols-5 gap-2'>
                        {[
                          {
                            key: "color1" as const,
                            label: "↙",
                          },
                          {
                            key: "color2" as const,
                            label: "↘",
                          },
                          {
                            key: "color3" as const,
                            label: "↗",
                          },
                          {
                            key: "color4" as const,
                            label: "↖",
                          },
                          {
                            key: "color5" as const,
                            label: "●",
                          },
                        ].map(({ key, label }) => (
                          <div
                            key={key}
                            className='flex flex-col items-center gap-1'>
                            <label className='relative cursor-pointer'>
                              <input
                                type='color'
                                value={getCurrentColors()[key]}
                                onChange={(e) =>
                                  handleColorChange(key, e.target.value)
                                }
                                className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
                              />
                              <div
                                className='w-10 h-10 rounded-xl shadow-md border border-white/50 transition-transform active:scale-95'
                                style={{
                                  backgroundColor: getCurrentColors()[key],
                                }}
                              />
                            </label>
                            <span className='text-[11px] text-gray-400'>
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* Reset button */}
                      <div className='mt-4'>
                        <button
                          onClick={resetCurrentScheme}
                          className='px-3 py-1.5 text-[13px] font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 active:scale-95 transition-transform'>
                          Reset to default
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
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
                    <svg
                      className='w-5 h-5 text-white'
                      fill='none'
                      viewBox='0 0 24 24'
                      strokeWidth={2}
                      stroke='currentColor'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M12 4.5v15m7.5-7.5h-15'
                      />
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
                      <li>
                        Tap the{" "}
                        <span className='inline-flex items-center mx-1'>
                          <svg
                            className='w-4 h-4'
                            fill='none'
                            viewBox='0 0 24 24'
                            strokeWidth={1.5}
                            stroke='currentColor'>
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              d='M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15'
                            />
                          </svg>
                        </span>{" "}
                        Share button
                      </li>
                      <li>
                        Scroll down and tap <strong>Add to Home Screen</strong>
                      </li>
                      <li>
                        Tap <strong>Add</strong> in the top right
                      </li>
                    </ol>
                  </div>
                ) : (
                  <div className='text-[15px] text-gray-500 dark:text-gray-400 space-y-2'>
                    <p>To install DayTracker:</p>
                    <ol className='list-decimal list-inside space-y-1 ml-1'>
                      <li>Tap the menu button (⋮) in your browser</li>
                      <li>
                        Select <strong>Install app</strong> or{" "}
                        <strong>Add to Home Screen</strong>
                      </li>
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
              Activity Types
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

        {/* Nutrition Settings Section */}
        {(() => {
          const nutritionTypes = allActivityTypes.filter(
            (t) => t.valueType === "nutrition",
          );

          // Find which types are currently selected for merging (primary has mergedNutritionTypeIds array)
          const primaryType = nutritionTypes.find(
            (t) => t.mergedNutritionTypeIds !== undefined,
          );
          const mergedIds = primaryType?.mergedNutritionTypeIds || [];

          // Check if merge is actually active (primary + at least one other)
          const isMergeActive = primaryType && mergedIds.length > 0;

          // Check if a type is selected for merge
          const isTypeSelected = (typeId: string) => {
            return typeId === primaryType?.id || mergedIds.includes(typeId);
          };

          // Toggle merge for a type
          const toggleMerge = (type: (typeof nutritionTypes)[0]) => {
            if (!primaryType) {
              // No merge group exists - make this type the primary with empty merge list
              // (needs at least one more to actually merge)
              updateActivityType({
                ...type,
                mergedNutritionTypeIds: [],
              });
            } else if (type.id === primaryType.id) {
              // Clicking on primary - remove all merge settings
              updateActivityType({
                ...primaryType,
                mergedNutritionTypeIds: undefined,
                mergedNutritionGoal: undefined,
              });
            } else if (mergedIds.includes(type.id)) {
              // Remove this type from merge
              const newMergedIds = mergedIds.filter((id) => id !== type.id);
              updateActivityType({
                ...primaryType,
                mergedNutritionTypeIds: newMergedIds,
              });
            } else {
              // Add this type to merge
              updateActivityType({
                ...primaryType,
                mergedNutritionTypeIds: [...mergedIds, type.id],
              });
            }
          };

          return (
            <section>
              <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
                Nutrition
              </h2>
              <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
                <button
                  onClick={() =>
                    setNutritionMergeExpanded(!nutritionMergeExpanded)
                  }
                  className='w-full px-4 py-3 flex items-center justify-between active:bg-gray-100 dark:active:bg-gray-700'>
                  <div>
                    <span className='text-[17px] text-gray-900 dark:text-white'>
                      Merge Activities
                    </span>
                    {isMergeActive && (
                      <span className='text-[13px] text-gray-500 dark:text-gray-400 ml-2'>
                        ({mergedIds.length + 1} merged)
                      </span>
                    )}
                  </div>
                  <svg
                    className={cn(
                      "w-5 h-5 text-gray-400 transition-transform duration-200",
                      nutritionMergeExpanded && "rotate-180",
                    )}
                    fill='none'
                    viewBox='0 0 24 24'
                    strokeWidth={2}
                    stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M19.5 8.25l-7.5 7.5-7.5-7.5'
                    />
                  </svg>
                </button>
                {nutritionMergeExpanded && (
                  <>
                    <div className='px-4 py-3 border-t border-gray-200/80 dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-800/30'>
                      <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                        {nutritionTypes.length < 2
                          ? "You need at least 2 activities with the Nutrition value type to merge them."
                          : "Tap activities to merge. All merged activities turn green when combined total reaches 100%."}
                      </p>
                    </div>
                    {nutritionTypes.length >= 2 &&
                      nutritionTypes.map((type, index) => {
                        const isSelected = isTypeSelected(type.id);
                        return (
                          <button
                            key={type.id}
                            onClick={() => toggleMerge(type)}
                            className={cn(
                              "w-full px-4 py-3 flex items-center justify-between active:bg-gray-100 dark:active:bg-gray-700",
                              index < nutritionTypes.length - 1 &&
                                "border-b border-gray-200/80 dark:border-gray-700/80",
                            )}>
                            <div className='flex items-center gap-3'>
                              <span className='text-[17px] text-gray-900 dark:text-white'>
                                {type.name}
                              </span>
                            </div>
                            {isSelected && (
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
                        );
                      })}
                  </>
                )}
              </div>
            </section>
          );
        })()}

        {/* Location/Weather Section */}
        <section className='mb-6'>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            Weather
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            <button
              onClick={() => setLocationExpanded(!locationExpanded)}
              className='w-full px-4 py-3 flex items-center justify-between active:bg-gray-100 dark:active:bg-gray-700'>
              <div className='flex items-center gap-3'>
                <div className='w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center'>
                  <svg
                    className='w-5 h-5 text-white'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                    strokeWidth={2}>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                    />
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                    />
                  </svg>
                </div>
                <div className='text-left'>
                  <span className='text-[17px] text-gray-900 dark:text-white'>
                    Location
                  </span>
                  {storedLocation && (
                    <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                      {storedLocation.name}
                    </p>
                  )}
                </div>
              </div>
              <svg
                className={cn(
                  "w-5 h-5 text-gray-400 transition-transform",
                  locationExpanded && "rotate-90",
                )}
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M9 5l7 7-7 7'
                />
              </svg>
            </button>

            {locationExpanded && (
              <div className='border-t border-gray-200/80 dark:border-gray-700/80'>
                <div className='px-4 py-3'>
                  <p className='text-[13px] text-gray-500 dark:text-gray-400 mb-3'>
                    Set your location to see weather on the home screen.
                  </p>

                  {/* Current location display */}
                  {storedLocation && (
                    <div className='flex items-center justify-between bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 mb-3'>
                      <div>
                        <p className='text-[15px] font-medium text-gray-900 dark:text-white'>
                          {storedLocation.name}
                        </p>
                        <p className='text-[12px] text-gray-500 dark:text-gray-400'>
                          {storedLocation.latitude.toFixed(2)}°,{" "}
                          {storedLocation.longitude.toFixed(2)}°
                        </p>
                      </div>
                      <button
                        onClick={handleClearLocation}
                        className='text-ios-red text-[15px] font-medium'>
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Search input */}
                  <div className='relative'>
                    <input
                      type='text'
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      placeholder='Search for a city...'
                      className='w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-[15px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                    />
                    {isSearchingLocation && (
                      <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                        <svg
                          className='w-5 h-5 text-gray-400 animate-spin'
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
                    )}
                  </div>

                  {/* Search results */}
                  {locationResults.length > 0 && (
                    <div className='mt-2 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden'>
                      {locationResults.map((result, index) => (
                        <button
                          key={`${result.latitude}-${result.longitude}-${index}`}
                          onClick={() => handleSelectLocation(result)}
                          className='w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-0'>
                          <div>
                            <p className='text-[15px] text-gray-900 dark:text-white'>
                              {result.name}
                            </p>
                            <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                              {result.admin1 ? `${result.admin1}, ` : ""}
                              {result.country}
                            </p>
                          </div>
                          <svg
                            className='w-5 h-5 text-gray-400'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'
                            strokeWidth={2}>
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              d='M12 4v16m8-8H4'
                            />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Fun Facts Section */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            Fun Facts
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            <button
              onClick={() => setFunFactsExpanded(!funFactsExpanded)}
              className='w-full px-4 py-3 flex items-center justify-between min-h-[44px] active:bg-gray-100 dark:active:bg-gray-700'>
              <div className='flex-1'>
                <span className='text-[17px] text-gray-900 dark:text-white'>
                  Categories
                </span>
              </div>
              <svg
                className={cn(
                  "w-5 h-5 text-gray-400 transition-transform",
                  funFactsExpanded && "rotate-180",
                )}
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={2}
                stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M19.5 8.25l-7.5 7.5-7.5-7.5'
                />
              </svg>
            </button>
            {funFactsExpanded && (
              <>
                {(Object.keys(CATEGORY_LABELS) as FunFactCategory[]).map(
                  (category, index, arr) => {
                    const isSelected = funFactCategories.includes(category);
                    return (
                      <div
                        key={category}
                        className='flex items-center border-t border-gray-200/80 dark:border-gray-700/80'>
                        {/* Test button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            testFunFactCategory(category);
                          }}
                          disabled={loadingTestCategory === category}
                          className='px-3 py-3 flex items-center justify-center active:bg-gray-100 dark:active:bg-gray-700'>
                          {loadingTestCategory === category ? (
                            <svg
                              className='w-5 h-5 text-gray-400 animate-spin'
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
                          ) : (
                            <svg
                              className='w-5 h-5 text-yellow-500'
                              fill='none'
                              viewBox='0 0 24 24'
                              strokeWidth={1.5}
                              stroke='currentColor'>
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                d='M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18'
                              />
                            </svg>
                          )}
                        </button>
                        {/* Category toggle */}
                        <button
                          onClick={() => toggleFunFactCategory(category)}
                          className='flex-1 px-1 py-3 flex items-center justify-between active:bg-gray-100 dark:active:bg-gray-700 pr-4'>
                          <span className='text-[17px] text-gray-900 dark:text-white'>
                            {CATEGORY_LABELS[category]}
                          </span>
                          {isSelected && (
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
                      </div>
                    );
                  },
                )}
              </>
            )}
          </div>
          <p className='text-[13px] text-gray-500 dark:text-gray-400 px-4 mt-2'>
            Select categories for fun facts shown when locking your day.
          </p>
        </section>

        {/* About Section */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            About
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl'>
            <div className='px-4 py-3 flex items-center justify-between min-h-[44px] border-b border-gray-200/80 dark:border-gray-700/80'>
              <span className='text-[17px] text-gray-900 dark:text-white'>
                App
              </span>
              <span className='text-[17px] text-gray-500'>DayTracker</span>
            </div>
            <div className='px-4 py-3 flex items-center justify-between min-h-[44px] border-b border-gray-200/80 dark:border-gray-700/80'>
              <span className='text-[17px] text-gray-900 dark:text-white'>
                Version
              </span>
              <span className='text-[17px] text-gray-500'>1.0.0</span>
            </div>
            <div className='px-4 py-3 min-h-[44px]'>
              <span className='text-[17px] text-gray-900 dark:text-white'>
                Data storage
              </span>
              <p className='text-[15px] text-gray-500 mt-1'>
                When signed in, your data is stored securely in the cloud and
                syncs across devices. When not signed in, data is stored locally
                on your device.
              </p>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            Data
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            <button
              onClick={() => setShowDeleteAllDataModal(true)}
              className='w-full px-4 py-3 min-h-[44px] text-[17px] text-ios-red text-center active:bg-gray-100 dark:active:bg-gray-700 border-b border-gray-200/80 dark:border-gray-700/80'>
              Delete all data
            </button>
            {user && (
              <button
                onClick={() => setShowDeleteAccountModal(true)}
                disabled={authLoading}
                className='w-full px-4 py-3 min-h-[44px] text-[17px] text-ios-red text-center active:bg-gray-100 dark:active:bg-gray-700 disabled:opacity-50 cursor-pointer'>
                Delete Account
              </button>
            )}
          </div>
          <p className='text-[13px] text-gray-500 dark:text-gray-400 px-4 mt-2'>
            This will delete all logged data and all activity types.
          </p>
        </section>

        {/* Admin Section - only visible to admin */}
        {user?.email === "marius.r.hesby@gmail.com" && (
          <section>
            <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
              Admin
            </h2>
            <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
              <a
                href='/admin'
                className='w-full px-4 py-3 min-h-[44px] flex items-center justify-between active:bg-gray-100 dark:active:bg-gray-700 border-b border-gray-200 dark:border-gray-700'>
                <span className='text-[17px] text-gray-900 dark:text-white'>
                  Admin Dashboard
                </span>
                <svg
                  className='w-5 h-5 text-gray-400'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth={2}
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M8.25 4.5l7.5 7.5-7.5 7.5'
                  />
                </svg>
              </a>
            </div>
          </section>
        )}
      </main>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditingProfile}
        onClose={() => setIsEditingProfile(false)}
      />

      {/* Delete All Data Confirmation Modal */}
      {showDeleteAllDataModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center px-4'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => !isDeleting && setShowDeleteAllDataModal(false)}
          />
          <div className='relative w-full max-w-sm bg-white dark:bg-ios-card-dark rounded-2xl overflow-hidden animate-scale-in'>
            <div className='p-6 text-center'>
              <h3 className='text-[17px] font-semibold text-gray-900 dark:text-white mb-2'>
                Delete all data?
              </h3>
              <p className='text-[15px] text-gray-500 dark:text-gray-400'>
                Are you sure you want to delete all data? This cannot be undone.
              </p>
            </div>
            <div className='border-t border-gray-200 dark:border-gray-700 flex'>
              <button
                onClick={() => setShowDeleteAllDataModal(false)}
                disabled={isDeleting}
                className='flex-1 py-3.5 text-[17px] font-medium text-ios-blue border-r border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-800 disabled:opacity-50'>
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    if (user) {
                      // Delete from Supabase if logged in
                      await deleteAllData();
                    } else {
                      // Just clear local data if not logged in
                      indexedDB.deleteDatabase("daytracker-db");
                      localStorage.clear();
                    }
                    window.location.reload();
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className='flex-1 py-3.5 text-[17px] font-medium text-ios-red active:bg-gray-100 dark:active:bg-gray-800 disabled:opacity-50'>
                {isDeleting ? (
                  <span className='flex items-center justify-center gap-2'>
                    <svg className='animate-spin h-4 w-4' viewBox='0 0 24 24'>
                      <circle
                        className='opacity-25'
                        cx='12'
                        cy='12'
                        r='10'
                        stroke='currentColor'
                        strokeWidth='4'
                        fill='none'
                      />
                      <path
                        className='opacity-75'
                        fill='currentColor'
                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                      />
                    </svg>
                    Delete...
                  </span>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => {
              if (!isDeleting) {
                setShowDeleteAccountModal(false);
                setDeleteConfirmText("");
              }
            }}
          />
          <div className='relative bg-white dark:bg-gray-800 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl'>
            <h3 className='text-xl font-bold text-gray-900 dark:text-white mb-2'>
              Delete Account
            </h3>
            <p className='text-[15px] text-gray-600 dark:text-gray-400 mb-4'>
              Are you sure you want to delete your account? This will
              permanently delete all your data and cannot be undone.
            </p>
            <p className='text-[13px] text-ios-red mb-4'>
              ⚠️ This action is irreversible. All your activities, entries,
              shares, and profile will be permanently deleted.
            </p>
            <div className='mb-4'>
              <label className='text-[13px] text-gray-500 dark:text-gray-400 mb-1 block'>
                Type DELETE to confirm
              </label>
              <input
                type='text'
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder='DELETE'
                className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-[17px] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-ios-red'
                disabled={isDeleting}
              />
            </div>
            <div className='flex gap-3'>
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteConfirmText("");
                }}
                disabled={isDeleting}
                className='flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-[17px] font-medium disabled:opacity-50'>
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirmText !== "DELETE") return;
                  setIsDeleting(true);
                  const { error } = await deleteAccount();
                  if (error) {
                    setAuthMessage(error.message);
                    setAuthMessageType("error");
                    setIsDeleting(false);
                  } else {
                    // Redirect to home after successful deletion
                    window.location.href = "/";
                  }
                }}
                disabled={isDeleting || deleteConfirmText !== "DELETE"}
                className='flex-1 px-4 py-3 bg-ios-red text-white rounded-lg text-[17px] font-medium disabled:opacity-50'>
                {isDeleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes scale-in {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>

      {/* Test Fun Fact Modal */}
      {showTestFunFact && testFunFact && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          {/* Backdrop */}
          <div
            className='absolute inset-0 bg-black/50 backdrop-blur-sm'
            onClick={() => {
              setShowTestFunFact(false);
              setShowTestAnswer(false);
              setTestSelectedAnswer(null);
            }}
          />
          {/* Modal */}
          <div className='relative bg-white dark:bg-ios-card-dark rounded-2xl shadow-xl max-w-sm w-full p-6 animate-scale-in'>
            {/* Light bulb icon */}
            <div className='flex justify-center mb-4'>
              <div className='w-14 h-14 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center'>
                <svg
                  className='w-8 h-8 text-yellow-500'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth={1.5}
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18'
                  />
                </svg>
              </div>
            </div>
            {/* Category badge */}
            <div className='flex justify-center mb-2'>
              <span className='text-[12px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide'>
                {CATEGORY_LABELS[testFunFact.category]}
              </span>
            </div>
            {/* Title */}
            <h3 className='text-lg font-semibold text-center text-gray-900 dark:text-white mb-3'>
              {testFunFact.answer ? "Trivia Time!" : "Did You Know?"}
            </h3>
            {/* Fun fact text */}
            <p className='text-gray-600 dark:text-gray-300 text-center text-[15px] leading-relaxed mb-4'>
              {testFunFact.fact}
            </p>
            {/* Multiple choice options */}
            {testFunFact.choices && testFunFact.choices.length > 0 && (
              <div className='mb-4 space-y-2'>
                {testFunFact.choices.map((choice, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setTestSelectedAnswer(choice);
                      setShowTestAnswer(true);
                      const isCorrect = choice === testFunFact.answer;
                      setShowTestAnswerAnimation(
                        isCorrect ? "correct" : "wrong",
                      );
                      // Auto-close after correct animation
                      if (isCorrect) {
                        setTimeout(() => {
                          setShowTestFunFact(false);
                          setShowTestAnswer(false);
                          setTestSelectedAnswer(null);
                        }, 1500);
                      }
                      setTimeout(() => setShowTestAnswerAnimation(null), 1500);
                    }}
                    disabled={showTestAnswer}
                    className={cn(
                      "w-full py-2.5 px-4 rounded-xl text-[15px] text-left transition-all",
                      showTestAnswer
                        ? choice === testFunFact.answer
                          ? "bg-ios-green/20 dark:bg-ios-green/30 text-ios-green font-semibold ring-2 ring-ios-green"
                          : choice === testSelectedAnswer
                            ? "bg-ios-red/20 dark:bg-ios-red/30 text-ios-red ring-2 ring-ios-red"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-600",
                    )}>
                    <span className='font-medium mr-2'>
                      {String.fromCharCode(65 + index)}.
                    </span>
                    {choice}
                  </button>
                ))}
              </div>
            )}
            {/* Answer section for trivia without choices */}
            {testFunFact.answer && !testFunFact.choices && (
              <div className='mb-4'>
                {showTestAnswer ? (
                  <div className='bg-ios-green/10 dark:bg-ios-green/20 rounded-xl p-3'>
                    <p className='text-[13px] text-gray-500 dark:text-gray-400 text-center mb-1'>
                      Answer:
                    </p>
                    <p className='text-ios-green font-semibold text-center text-[16px]'>
                      {testFunFact.answer}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowTestAnswer(true)}
                    className='w-full py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-xl active:opacity-80 transition-opacity text-[15px]'>
                    Reveal Answer
                  </button>
                )}
              </div>
            )}

            {/* Button for quotes/fun facts (no trivia) */}
            {!testFunFact.answer && !testFunFact.choices && (
              <button
                onClick={() => {
                  setShowTestFunFact(false);
                }}
                className='w-full py-3 bg-ios-blue text-white font-semibold rounded-xl active:opacity-80 transition-opacity'>
                Good to know
              </button>
            )}

            {/* Button before answering trivia: "I don't wanna play" */}
            {testFunFact.choices && !showTestAnswer && (
              <button
                onClick={() => {
                  setShowTestFunFact(false);
                  setShowTestAnswer(false);
                  setTestSelectedAnswer(null);
                }}
                className='w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium rounded-xl active:opacity-80 transition-opacity'>
                I don&apos;t wanna play
              </button>
            )}

            {/* Buttons after wrong answer */}
            {testFunFact.choices &&
              showTestAnswer &&
              testSelectedAnswer !== testFunFact.answer && (
                <div className='flex gap-2'>
                  <button
                    onClick={async () => {
                      // Reset state and fetch a new fun fact
                      setShowTestAnswer(false);
                      setTestSelectedAnswer(null);
                      setShowTestAnswerAnimation(null);
                      const fact = await fetchRandomFunFact();
                      if (fact) {
                        setTestFunFact(fact);
                      }
                    }}
                    className='flex-1 py-3 bg-ios-blue text-white font-semibold rounded-xl active:opacity-80 transition-opacity'>
                    Try again
                  </button>
                  <button
                    onClick={() => {
                      setShowTestFunFact(false);
                      setShowTestAnswer(false);
                      setTestSelectedAnswer(null);
                    }}
                    className='flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium rounded-xl active:opacity-80 transition-opacity'>
                    D&apos;oh! I&apos;m out
                  </button>
                </div>
              )}
          </div>

          {/* Answer Animation Overlay */}
          {showTestAnswerAnimation && (
            <div className='absolute inset-0 flex items-center justify-center pointer-events-none z-10'>
              <div
                className={cn(
                  "answer-animation-text",
                  showTestAnswerAnimation === "correct"
                    ? "correct-animation"
                    : "wrong-animation",
                )}>
                {showTestAnswerAnimation === "correct" ? "CORRECT!" : "WRONG!"}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Answer Animation Styles */}
      <style jsx>{`
        .answer-animation-text {
          font-size: 3rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          animation-fill-mode: forwards;
        }

        .correct-animation {
          color: #22c55e;
          text-shadow:
            0 0 10px rgba(34, 197, 94, 0.8),
            0 0 20px rgba(34, 197, 94, 0.6),
            0 0 40px rgba(34, 197, 94, 0.4),
            0 0 80px rgba(34, 197, 94, 0.2);
          animation: correctBurst 1.5s ease-out forwards;
        }

        .wrong-animation {
          color: #ef4444;
          text-shadow:
            0 0 10px rgba(239, 68, 68, 0.8),
            0 0 20px rgba(239, 68, 68, 0.6),
            0 0 40px rgba(239, 68, 68, 0.4),
            0 0 80px rgba(239, 68, 68, 0.2);
          animation: wrongShatter 1.5s ease-out forwards;
        }

        @keyframes correctBurst {
          0% {
            transform: scale(0.3) translateZ(0);
            opacity: 0;
            filter: blur(10px);
          }
          20% {
            transform: scale(1.3) translateZ(100px);
            opacity: 1;
            filter: blur(0);
          }
          40% {
            transform: scale(1.1) translateZ(150px);
            opacity: 1;
          }
          60% {
            transform: scale(1.2) translateZ(200px);
            opacity: 0.9;
            filter: blur(1px);
          }
          100% {
            transform: scale(2.5) translateZ(500px);
            opacity: 0;
            filter: blur(20px);
          }
        }

        @keyframes wrongShatter {
          0% {
            transform: scale(0.3) rotate(0deg) translateZ(0);
            opacity: 0;
            filter: blur(10px);
          }
          15% {
            transform: scale(1.4) rotate(-3deg) translateZ(80px);
            opacity: 1;
            filter: blur(0);
          }
          25% {
            transform: scale(1.3) rotate(3deg) translateZ(100px);
          }
          35% {
            transform: scale(1.35) rotate(-2deg) translateZ(120px);
          }
          45% {
            transform: scale(1.3) rotate(2deg) translateZ(140px);
          }
          55% {
            transform: scale(1.4) rotate(0deg) translateZ(180px);
            opacity: 1;
          }
          70% {
            transform: scale(1.8) rotate(5deg) translateZ(250px);
            opacity: 0.7;
            filter: blur(3px);
          }
          85% {
            transform: scale(2.5) rotate(-8deg) translateZ(400px);
            opacity: 0.3;
            filter: blur(10px);
          }
          100% {
            transform: scale(4) rotate(15deg) translateZ(600px);
            opacity: 0;
            filter: blur(30px);
          }
        }
      `}</style>
    </div>
  );
}
