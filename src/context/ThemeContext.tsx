"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Theme = "light" | "dark" | "colorful" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark" | "colorful";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<
    "light" | "dark" | "colorful"
  >("light");

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) {
      setThemeState(saved);
    }
  }, []);

  // Resolve the actual theme and apply it
  useEffect(() => {
    const applyTheme = () => {
      let resolved: "light" | "dark" | "colorful";

      if (theme === "system") {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      } else {
        resolved = theme;
      }

      setResolvedTheme(resolved);

      // Remove all theme classes first
      document.documentElement.classList.remove(
        "dark",
        "colorful",
        "colorful-1",
        "colorful-2",
        "colorful-3",
        "colorful-4",
      );

      // Apply the appropriate class
      if (resolved === "dark") {
        document.documentElement.classList.add("dark");
      } else if (resolved === "colorful") {
        document.documentElement.classList.add("colorful");
        // Also apply the saved color scheme
        const savedScheme = localStorage.getItem("colorScheme") || "1";
        document.documentElement.classList.add(`colorful-${savedScheme}`);

        // Apply custom colors if scheme 4
        if (savedScheme === "4") {
          const customColors = localStorage.getItem("customColors");
          if (customColors) {
            try {
              const colors = JSON.parse(customColors);
              const root = document.documentElement;
              root.style.setProperty("--custom-color-1", colors.color1);
              root.style.setProperty("--custom-color-2", colors.color2);
              root.style.setProperty("--custom-color-3", colors.color3);
              root.style.setProperty("--custom-color-4", colors.color4);
              root.style.setProperty("--custom-color-5", colors.color5);
            } catch {
              // Invalid JSON, ignore
            }
          }
        }
      }
    };

    applyTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
