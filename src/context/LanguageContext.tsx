"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type Language = "en" | "no";

// Translation keys and their values
export const translations = {
  en: {
    // Tabs
    "tab.today": "Today",
    "tab.moviesTv": "Movies & TV",
    "tab.statistics": "Statistics",
    "tab.settings": "Settings",

    // Main page
    "main.loading": "Loading...",

    // Date Navigator
    "date.today": "Today",
    "date.tapToGoToday": "Tap to go to today",
    "date.previousDay": "Previous day",
    "date.nextDay": "Next day",

    // Entry Form
    "entry.yes": "Yes",
    "entry.no": "No",
    "entry.add": "Add",
    "entry.orEnterNew": "Or enter new...",
    "entry.enterValue": "Enter value...",
    "entry.previouslyWatched": "Previously watched:",
    "entry.searchMovie": "Search for movie...",
    "entry.searchSeries": "Search for TV series...",

    // Statistics
    "stats.title": "Statistics",
    "stats.week": "Week",
    "stats.month": "Month",
    "stats.year": "Year",
    "stats.entriesOverDays": "entries over",
    "stats.days": "days",
    "stats.tapToSeeDates": "Tap to see dates",
    "stats.daysWithValue": "days with this value",
    "stats.average": "Average",
    "stats.selectActivity": "Select an activity to see statistics",
    "stats.less": "Less",
    "stats.more": "More",

    // History/Film page
    "film.title": "Movies / TV Series",
    "film.movies": "Movies",
    "film.series": "Series",
    "film.newest": "Newest",
    "film.myRating": "My rating",
    "film.noMovies": "No movies found",
    "film.noSeries": "No series found",
    "film.cancel": "Cancel",
    "film.addRating": "+ Add rating",

    // Settings
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.light": "Light",
    "settings.dark": "Dark",
    "settings.system": "System",
    "settings.activityTypes": "Activity Types",
    "settings.addActivity": "+ Add",
    "settings.name": "Name",
    "settings.icon": "Icon",
    "settings.selectIcon": "Select icon",
    "settings.chooseIcon": "Select an icon:",
    "settings.valueType": "Value type",
    "settings.textMultiple": "Text (multiple)",
    "settings.number": "Number",
    "settings.yesNoSingle": "Yes/No (single)",
    "settings.checkmark": "✓ Checkmark (single)",
    "settings.unit": "Unit",
    "settings.unitPlaceholder": "E.g. km, minutes",
    "settings.namePlaceholder": "E.g. Exercise",
    "settings.update": "Update",
    "settings.add": "Add",
    "settings.cancel": "Cancel",
    "settings.edit": "Edit",
    "settings.delete": "Delete",
    "settings.duplicateError":
      "An activity type with this name already exists.",
    "settings.deleteConfirm":
      "Delete this activity type? Existing entries will not be deleted.",
    "settings.about": "About",
    "settings.app": "App",
    "settings.version": "Version",
    "settings.dataStorage": "Data storage",
    "settings.dataStorageDesc":
      "All data is stored locally on your device using IndexedDB.",
    "settings.data": "Data",
    "settings.deleteAllData": "Delete all data",
    "settings.deleteAllConfirm":
      "Are you sure you want to delete all data? This cannot be undone.",
    "settings.deleteAllDesc":
      "This will delete all logged data and all activity types.",

    // Media Search
    "media.notConfigured": "OMDB API not configured",
    "media.addApiKey": "Add",
    "media.toEnvLocal": "to .env.local",
    "media.getFreeKey": "Get free API key here →",
    "media.movie": "Movie",
    "media.tvSeries": "TV Series",
    "media.openImdb": "Open on IMDB",
    "media.viewImdb": "View on IMDB",
  },
  no: {
    // Tabs
    "tab.today": "I dag",
    "tab.moviesTv": "Film & TV",
    "tab.statistics": "Statistikk",
    "tab.settings": "Innstillinger",

    // Main page
    "main.loading": "Laster...",

    // Date Navigator
    "date.today": "I dag",
    "date.tapToGoToday": "Trykk for å gå til i dag",
    "date.previousDay": "Forrige dag",
    "date.nextDay": "Neste dag",

    // Entry Form
    "entry.yes": "Ja",
    "entry.no": "Nei",
    "entry.add": "Legg til",
    "entry.orEnterNew": "Eller skriv ny...",
    "entry.enterValue": "Skriv verdi...",
    "entry.previouslyWatched": "Tidligere sett:",
    "entry.searchMovie": "Søk etter film...",
    "entry.searchSeries": "Søk etter TV-serie...",

    // Statistics
    "stats.title": "Statistikk",
    "stats.week": "Uke",
    "stats.month": "Måned",
    "stats.year": "År",
    "stats.entriesOverDays": "registreringer over",
    "stats.days": "dager",
    "stats.tapToSeeDates": "Trykk for å se datoer",
    "stats.daysWithValue": "dager med denne verdien",
    "stats.average": "Gjennomsnitt",
    "stats.selectActivity": "Velg en aktivitet for å se statistikk",
    "stats.less": "Mindre",
    "stats.more": "Mer",

    // History/Film page
    "film.title": "Film / TV-serier",
    "film.movies": "Filmer",
    "film.series": "Serier",
    "film.newest": "Nyeste",
    "film.myRating": "Min rating",
    "film.noMovies": "Ingen filmer funnet",
    "film.noSeries": "Ingen serier funnet",
    "film.cancel": "Avbryt",
    "film.addRating": "+ Legg til rating",

    // Settings
    "settings.title": "Innstillinger",
    "settings.language": "Språk",
    "settings.theme": "Tema",
    "settings.light": "Lys",
    "settings.dark": "Mørk",
    "settings.system": "System",
    "settings.activityTypes": "Aktivitetstyper",
    "settings.addActivity": "+ Legg til",
    "settings.name": "Navn",
    "settings.icon": "Ikon",
    "settings.selectIcon": "Velg ikon",
    "settings.chooseIcon": "Velg et ikon:",
    "settings.valueType": "Verditype",
    "settings.textMultiple": "Tekst (flere)",
    "settings.number": "Tall",
    "settings.yesNoSingle": "Ja/Nei (enkelt)",
    "settings.checkmark": "✓ Avkrysning (enkelt)",
    "settings.unit": "Enhet",
    "settings.unitPlaceholder": "F.eks. km, minutter",
    "settings.namePlaceholder": "F.eks. Trening",
    "settings.update": "Oppdater",
    "settings.add": "Legg til",
    "settings.cancel": "Avbryt",
    "settings.edit": "Rediger",
    "settings.delete": "Slett",
    "settings.duplicateError":
      "En aktivitetstype med dette navnet finnes allerede.",
    "settings.deleteConfirm":
      "Slette denne aktivitetstypen? Eksisterende registreringer slettes ikke.",
    "settings.about": "Om appen",
    "settings.app": "App",
    "settings.version": "Versjon",
    "settings.dataStorage": "Datalagring",
    "settings.dataStorageDesc":
      "All data lagres lokalt på enheten din med IndexedDB.",
    "settings.data": "Data",
    "settings.deleteAllData": "Slett all data",
    "settings.deleteAllConfirm":
      "Er du sikker på at du vil slette all data? Dette kan ikke angres.",
    "settings.deleteAllDesc":
      "Dette vil slette all loggført data og alle aktivitetstyper.",

    // Media Search
    "media.notConfigured": "OMDB API ikke konfigurert",
    "media.addApiKey": "Legg til",
    "media.toEnvLocal": "i .env.local",
    "media.getFreeKey": "Få gratis API-nøkkel her →",
    "media.movie": "Film",
    "media.tvSeries": "TV-serie",
    "media.openImdb": "Åpne på IMDB",
    "media.viewImdb": "Se på IMDB",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  // Load saved language on mount
  useEffect(() => {
    const saved = localStorage.getItem("language") as Language | null;
    if (saved && (saved === "en" || saved === "no")) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
