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

    // Account/Auth
    "settings.account": "Account",
    "settings.loggedIn": "Logged in",
    "settings.signOut": "Sign Out",
    "settings.signInDesc": "Sign in to sync your data across devices",
    "settings.emailPlaceholder": "Enter your email",
    "settings.passwordPlaceholder": "Enter password (min 6 characters)",
    "settings.signIn": "Sign In",
    "settings.createAccount": "Create Account",
    "settings.loading": "Loading...",
    "settings.haveAccount": "Already have an account? Sign in",
    "settings.noAccount": "Don't have an account? Create one",
    "settings.passwordMin": "Password must be at least 6 characters",
    "settings.accountCreated": "Account created! You are now logged in.",
    "settings.checkEmailConfirm":
      "Check your email to confirm your account, then sign in.",
    "settings.invalidCredentials":
      "Invalid email or password. Please try again.",
    "settings.enterEmail": "Please enter your email",
    "settings.syncNow": "Sync Now",
    "settings.syncing": "Syncing...",
    "settings.syncComplete": "Data synced successfully!",
    "settings.syncFailed": "Sync failed. Please try again.",
    "settings.cloudSyncDesc":
      "Sign in to keep your data safe in the cloud and sync across devices.",

    // Friends/Sharing
    "tab.friends": "Friends",
    "friends.title": "Friends",
    "friends.addFriend": "Add Friend",
    "friends.sharedWithMe": "Shared",
    "friends.requests": "Requests",
    "friends.myShares": "My Shares",
    "friends.noSharedData": "No one is sharing data with you yet",
    "friends.activities": "activities",
    "friends.incoming": "Incoming requests",
    "friends.outgoing": "Sent requests",
    "friends.noIncoming": "No incoming requests",
    "friends.noOutgoing": "No sent requests",
    "friends.wantsAccess": "wants to see your data",
    "friends.accept": "Accept",
    "friends.reject": "Decline",
    "friends.pending": "Pending",
    "friends.accepted": "Accepted",
    "friends.rejected": "Declined",
    "friends.noShares": "You're not sharing with anyone",
    "friends.edit": "Edit",
    "friends.remove": "Remove",
    "friends.sendRequest": "Send Request",
    "friends.sendRequestDesc":
      "Enter the email of the friend you want to request access from:",
    "friends.emailPlaceholder": "friend@example.com",
    "friends.send": "Send Request",
    "friends.requestSent": "Request sent!",
    "friends.requestAccepted": "Request accepted!",
    "friends.confirmRemove":
      "Are you sure you want to stop sharing with this person?",
    "friends.selectActivities": "Select Activities to Share",
    "friends.selectActivitiesDesc": "Choose which activities to share with",
    "friends.acceptAndShare": "Accept & Share",
    "friends.editPermissions": "Edit Permissions",
    "friends.editPermissionsDesc": "Choose which activities to share with",
    "friends.saveChanges": "Save Changes",
    "friends.noEntries": "No entries",
    "friends.loginRequired": "Please log in to use the sharing feature",
    "friends.viewingData": "Viewing shared data",
    "friends.backToMyData": "Back to my data",

    // Media Search
    "media.notConfigured": "OMDB API not configured",
    "media.addApiKey": "Add",
    "media.toEnvLocal": "to .env.local",
    "media.getFreeKey": "Get free API key here →",
    "media.movie": "Movie",
    "media.tvSeries": "TV Series",
    "media.openImdb": "Open on IMDB",
    "media.viewImdb": "View on IMDB",

    // Profile
    "profile.setupTitle": "Complete Your Profile",
    "profile.setupDesc": "Tell us a bit about yourself",
    "profile.chooseAvatar": "Choose an avatar",
    "profile.fullName": "Full Name",
    "profile.fullNamePlaceholder": "Enter your full name",
    "profile.nameRequired": "Please enter your name",
    "profile.saving": "Saving...",
    "profile.continue": "Continue",
    "profile.editProfile": "Edit Profile",
    "profile.save": "Save",
    "profile.upload": "Upload",
    "profile.invalidImage": "Please select an image file",
    "profile.imageTooLarge": "Image must be under 2MB",
    "profile.uploadFailed": "Failed to upload image",
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

    // Account/Auth
    "settings.account": "Konto",
    "settings.loggedIn": "Logget inn",
    "settings.signOut": "Logg ut",
    "settings.signInDesc":
      "Logg inn for å synkronisere data på tvers av enheter",
    "settings.emailPlaceholder": "Skriv inn e-posten din",
    "settings.passwordPlaceholder": "Skriv inn passord (min 6 tegn)",
    "settings.signIn": "Logg inn",
    "settings.createAccount": "Opprett konto",
    "settings.loading": "Laster...",
    "settings.haveAccount": "Har du allerede en konto? Logg inn",
    "settings.noAccount": "Har du ikke en konto? Opprett en",
    "settings.passwordMin": "Passord må være minst 6 tegn",
    "settings.accountCreated": "Konto opprettet! Du er nå logget inn.",
    "settings.checkEmailConfirm":
      "Sjekk e-posten din for å bekrefte kontoen, deretter logg inn.",
    "settings.invalidCredentials": "Ugyldig e-post eller passord. Prøv igjen.",
    "settings.enterEmail": "Vennligst skriv inn e-posten din",
    "settings.syncNow": "Synkroniser nå",
    "settings.syncing": "Synkroniserer...",
    "settings.syncComplete": "Data synkronisert!",
    "settings.syncFailed": "Synkronisering feilet. Prøv igjen.",
    "settings.cloudSyncDesc":
      "Logg inn for å holde dataene dine trygge i skyen og synkronisere på tvers av enheter.",

    // Friends/Sharing
    "tab.friends": "Venner",
    "friends.title": "Venner",
    "friends.addFriend": "Legg til venn",
    "friends.sharedWithMe": "Delt",
    "friends.requests": "Forespørsler",
    "friends.myShares": "Mine delinger",
    "friends.noSharedData": "Ingen deler data med deg ennå",
    "friends.activities": "aktiviteter",
    "friends.incoming": "Innkommende forespørsler",
    "friends.outgoing": "Sendte forespørsler",
    "friends.noIncoming": "Ingen innkommende forespørsler",
    "friends.noOutgoing": "Ingen sendte forespørsler",
    "friends.wantsAccess": "vil se dataene dine",
    "friends.accept": "Godta",
    "friends.reject": "Avslå",
    "friends.pending": "Venter",
    "friends.accepted": "Godtatt",
    "friends.rejected": "Avslått",
    "friends.noShares": "Du deler ikke med noen",
    "friends.edit": "Rediger",
    "friends.remove": "Fjern",
    "friends.sendRequest": "Send forespørsel",
    "friends.sendRequestDesc":
      "Skriv inn e-posten til vennen du vil be om tilgang fra:",
    "friends.emailPlaceholder": "venn@eksempel.no",
    "friends.send": "Send forespørsel",
    "friends.requestSent": "Forespørsel sendt!",
    "friends.requestAccepted": "Forespørsel godtatt!",
    "friends.confirmRemove":
      "Er du sikker på at du vil slutte å dele med denne personen?",
    "friends.selectActivities": "Velg aktiviteter å dele",
    "friends.selectActivitiesDesc": "Velg hvilke aktiviteter du vil dele med",
    "friends.acceptAndShare": "Godta og del",
    "friends.editPermissions": "Rediger tillatelser",
    "friends.editPermissionsDesc": "Velg hvilke aktiviteter du vil dele med",
    "friends.saveChanges": "Lagre endringer",
    "friends.noEntries": "Ingen registreringer",
    "friends.loginRequired": "Logg inn for å bruke delingsfunksjonen",
    "friends.viewingData": "Ser på delt data",
    "friends.backToMyData": "Tilbake til mine data",

    // Media Search
    "media.notConfigured": "OMDB API ikke konfigurert",
    "media.addApiKey": "Legg til",
    "media.toEnvLocal": "i .env.local",
    "media.getFreeKey": "Få gratis API-nøkkel her →",
    "media.movie": "Film",
    "media.tvSeries": "TV-serie",
    "media.openImdb": "Åpne på IMDB",
    "media.viewImdb": "Se på IMDB",

    // Profile
    "profile.setupTitle": "Fullfør profilen din",
    "profile.setupDesc": "Fortell oss litt om deg selv",
    "profile.chooseAvatar": "Velg en avatar",
    "profile.fullName": "Fullt navn",
    "profile.fullNamePlaceholder": "Skriv inn ditt fulle navn",
    "profile.nameRequired": "Vennligst skriv inn navnet ditt",
    "profile.saving": "Lagrer...",
    "profile.continue": "Fortsett",
    "profile.editProfile": "Rediger profil",
    "profile.save": "Lagre",
    "profile.upload": "Last opp",
    "profile.invalidImage": "Velg en bildefil",
    "profile.imageTooLarge": "Bildet må være under 2MB",
    "profile.uploadFailed": "Kunne ikke laste opp bilde",
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
