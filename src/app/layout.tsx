import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { AppShell } from "@/components";
import "./globals.css";

export const metadata: Metadata = {
  title: "DayTracker",
  description: "Track your daily activities and habits",
  icons: {
    icon: "/icon.svg",
    apple: "/logo.svg",
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
        <LanguageProvider>
          <ThemeProvider>
            <AppProvider>
              <AppShell>{children}</AppShell>
            </AppProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
