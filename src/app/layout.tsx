import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { AppShell, ProfileSetupWrapper } from "@/components";
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
    statusBarStyle: "black-translucent",
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
      <head>
        <meta
          name='theme-color'
          content='#f5f3f0'
          media='(prefers-color-scheme: light)'
        />
        <meta
          name='theme-color'
          content='#000000'
          media='(prefers-color-scheme: dark)'
        />
      </head>
      <body className='antialiased bg-ios-bg dark:bg-ios-bg-dark'>
        <AuthProvider>
          <ThemeProvider>
            <AppProvider>
              <NotificationProvider>
                <ProfileSetupWrapper />
                <AppShell>{children}</AppShell>
              </NotificationProvider>
            </AppProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
