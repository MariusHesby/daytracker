"use client";

import { createContext, useContext, ReactNode } from "react";

// Translation keys and their values
const translations = {
  // Common
  "common.cancel": "Cancel",

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
  "settings.duplicateError": "An activity type with this name already exists.",
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
  "settings.email": "Email",
  "settings.emailCannotChange": "Email cannot be changed",
  "settings.profileUpdated": "Profile updated!",
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
  "settings.invalidCredentials": "Invalid email or password. Please try again.",
  "settings.enterEmail": "Please enter your email",
  "settings.forgotPassword": "Forgot password?",
  "settings.resetPassword": "Reset Password",
  "settings.resetPasswordDesc":
    "Enter your email to receive a password reset link.",
  "settings.resetEmailSent": "Password reset email sent! Check your inbox.",
  "settings.resetLinkSent": "Link sent to your e-mail",
  "settings.sendResetLink": "Send Reset Link",
  "settings.backToSignIn": "Back to Sign In",
  "settings.syncNow": "Sync Now",
  "settings.syncing": "Syncing...",
  "settings.syncComplete": "Data synced successfully!",
  "settings.syncFailed": "Sync failed. Please try again.",
  "settings.cloudSyncDesc":
    "Sign in to keep your data safe in the cloud and sync across devices.",
  "settings.deleteAccount": "Delete Account",
  "settings.deleteAccountConfirm":
    "Are you sure you want to delete your account? This will permanently delete all your data and cannot be undone.",
  "settings.deleteAccountWarning":
    "This action is irreversible. All your activities, entries, shares, and profile will be permanently deleted.",
  "settings.deleting": "Deleting...",
  "settings.typeToConfirm": "Type DELETE to confirm",

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
  "friends.clearAll": "Clear",
  "friends.removeFriend": "Remove Friend",
  "friends.removeFriendWarning":
    "You will no longer be able to see their activities. They would need to share with you again if you want to reconnect.",
  "friends.selectActivities": "Select Activities to Share",
  "friends.selectActivitiesDesc": "Choose which activities to share with",
  "friends.acceptAndShare": "Accept & Share",
  "friends.alertLovedOne": "Alert your loved one when mood changes",
  "friends.editPermissions": "Edit Permissions",
  "friends.editPermissionsDesc": "Choose which activities to share with",
  "friends.saveChanges": "Save Changes",
  "friends.noEntries": "No entries",
  "friends.loginRequired": "Please log in to use the sharing feature",
  "friends.viewingData": "Viewing shared data",
  "friends.backToMyData": "Back to my data",
  "friends.searchUsers": "Search Users",
  "friends.searchPlaceholder": "Search by name or email...",
  "friends.noResults": "No users found",
  "friends.searchHint": "Type at least 2 characters to search",
  "friends.sendTo": "Send request to",

  // Common
  "common.remove": "Remove",
  "common.ok": "OK",

  // Period Alert
  "period.alertTitle": "Period Alert",
  "period.moodSad": "Oh no! Auntie Red has arrived 🩸",
  "period.moodHappy":
    "Whoop whoop, the store is open - go get her some flowers man! 💐",
  "period.moodNeutralFromSad":
    "Oh, we're half way there / Oh-oh, livin' on a prayer / Take my hand, we'll make it, I swear / Oh-oh, livin' on a prayer 🎸",
  "period.moodNeutralFromHappy":
    "Back off man, just back the fuck off, not in the mood 😤",

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
  "profile.upload": "Upload Photo",
  "profile.changePhoto": "Change Photo",
  "profile.invalidImage": "Please select an image file",
  "profile.imageTooLarge": "Image must be under 2MB",
  "profile.uploadFailed": "Failed to upload image",
  "profile.adjustPhoto": "Adjust Photo",
  "profile.choose": "Choose",
} as const;

export type TranslationKey = keyof typeof translations;

interface LanguageContextType {
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const t = (key: TranslationKey): string => {
    return translations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ t }}>
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
