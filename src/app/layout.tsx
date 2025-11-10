import type {Metadata} from 'next';
import './globals.css';
import {Header} from '@/components/header';
import {Footer} from '@/components/footer';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider, initializeFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Suspense } from 'react';
import { ThemeProvider } from '@/components/theme-provider';


export const metadata: Metadata = {
  title: 'КоНК - Коротко О Не Коротком',
  description: 'Поиск фрагментов из фильмов и сериалов',
};

async function SystemThemeLoader() {
  // We initialize a temporary instance here on the server to fetch the theme.
  // This doesn't affect the client-side singleton initialization.
  const { firestore } = initializeFirebase();
  const themeDocRef = doc(firestore, 'site_settings', 'theme');
  
  try {
    const themeDoc = await getDoc(themeDocRef);
    const theme = themeDoc.exists() ? themeDoc.data() : {};
    
    // Set default values directly in the style block if they don't exist in theme
    const style = `
      .theme-system {
        --background: ${theme.background || '240 5% 8%'};
        --foreground: ${theme.foreground || '0 0% 98%'};
        --card: ${theme.card || '240 5% 12%'};
        --card-foreground: ${theme.cardForeground || '0 0% 98%'};
        --popover: ${theme.popover || '240 5% 8%'};
        --popover-foreground: ${theme.popoverForeground || '0 0% 98%'};
        --primary: ${theme.primary || '262 80% 60%'};
        --primary-foreground: ${theme.primaryForeground || '0 0% 98%'};
        --secondary: ${theme.secondary || '240 5% 15%'};
        --secondary-foreground: ${theme.secondaryForeground || '0 0% 98%'};
        --muted: ${theme.muted || '240 5% 15%'};
        --muted-foreground: ${theme.mutedForeground || '0 0% 63.9%'};
        --accent: ${theme.accent || '190 95% 55%'};
        --accent-foreground: ${theme.accentForeground || '240 5% 8%'};
        --destructive: ${theme.destructive || '0 62.8% 30.6%'};
        --destructive-foreground: ${theme.destructiveForeground || '0 0% 98%'};
        --border: ${theme.border || '240 5% 20%'};
        --input: ${theme.input || '240 5% 20%'};
        --ring: ${theme.ring || '262 80% 60%'};
        --background-opacity: ${theme.backgroundOpacity ?? 1};
        --card-opacity: ${theme.cardOpacity ?? 1};
        --popover-opacity: ${theme.popoverOpacity ?? 1};
        --muted-opacity: ${theme.mutedOpacity ?? 1};
        --primary-opacity: ${theme.primaryOpacity ?? 1};
      }
    `;
    return <style>{style}</style>;

  } catch (error) {
    console.error("Failed to load theme from Firestore:", error);
  }
  
  return null;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <Suspense fallback={null}>
          <SystemThemeLoader />
        </Suspense>
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen">
       <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <FirebaseClientProvider>
              <Header />
              <main className="flex-grow">{children}</main>
              <Footer />
              <Toaster />
            </FirebaseClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
