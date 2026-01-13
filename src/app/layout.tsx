import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";
import { PeriodAlertProvider } from "@/context/PeriodAlertContext";
import { AppShell, ProfileSetupWrapper, PeriodAlertPopup } from "@/components";
import "./globals.css";

export const metadata: Metadata = {
  title: "DayTracker",
  description: "Track your daily activities and habits",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DayTracker",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className='antialiased bg-ios-bg dark:bg-ios-bg-dark'>
        <AuthProvider>
          <LanguageProvider>
            <ThemeProvider>
              <AppProvider>
                <PeriodAlertProvider>
                  <ProfileSetupWrapper />
                  <PeriodAlertPopup />
                  <AppShell>{children}</AppShell>
                </PeriodAlertProvider>
              </AppProvider>
            </ThemeProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
